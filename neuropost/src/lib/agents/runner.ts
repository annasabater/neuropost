// =============================================================================
// Agent runner — BullMQ Worker + Supabase persistence
// =============================================================================
// Processes agent jobs dispatched via BullMQ. Each Vercel cron tick:
//   1. Creates a short-lived BullMQ Worker (autorun: false)
//   2. Runs it for up to DRAIN_DURATION_MS (≤ Vercel maxDuration)
//   3. Closes the worker gracefully and returns stats
//
// The processor function:
//   - Receives a BullMQ job with { agent_job_id }
//   - Loads the full Supabase job row
//   - Dispatches to the registered handler
//   - Writes result back to Supabase
//
// BullMQ owns retry/backoff. Supabase owns status/outputs/audit trail.
// If Redis is unavailable, the cron falls back to claimJobs() (Supabase poll).

import type { Job as BullJob } from 'bullmq';
import * as Sentry from '@sentry/nextjs';
import { createAgentWorker, type AgentBullJob } from '@/lib/bullmq';
import { createAdminClient } from '@/lib/supabase';
import {
  saveOutputs,
  queueSubJobs,
  finalizeJob,
  releaseJobForRetry,
  claimJobs,
} from './queue';
import { lookupHandler } from './registry';
import type { AgentJob, HandlerResult } from './types';
import { logAgentAction } from '@/lib/audit';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export interface RunnerResult {
  claimed:     number;
  done:        number;
  errored:     number;
  retried:     number;
  needsReview: number;
  unhandled:   number;
  elapsedMs:   number;
  source:      'bullmq' | 'supabase_fallback';
}

const DEFAULT_BATCH_SIZE   = 10;
const DRAIN_DURATION_MS    = 290_000; // run worker for 290s (cron maxDuration = 300s, supports long video generation)
const HANDLER_TIMEOUT_MS   = 45_000;

// Long-running actions that need extended timeout (polling-based providers).
// HiggsField: image ~2min, video ~5min. RunwayML: ~2-3min.
const LONG_TIMEOUT_ACTIONS = new Set([
  'generate_human_photo',
  'generate_human_video',
  'generate_video',
]);
const LONG_HANDLER_TIMEOUT_MS = 330_000; // 5.5 minutes

/** Determine the timeout for a given job based on its action. */
function timeoutForJob(job: AgentJob): number {
  return LONG_TIMEOUT_ACTIONS.has(job.action) ? LONG_HANDLER_TIMEOUT_MS : HANDLER_TIMEOUT_MS;
}

/** Fire-and-forget worker notification on job state transitions. */
async function notifyJobEvent(job: AgentJob, event: 'completed' | 'failed' | 'needs_review', detail?: string) {
  if (!job.brand_id) return;
  try {
    const db: DB = createAdminClient();
    const label = `${job.agent_type}:${job.action}`;
    const msgs: Record<string, string> = {
      completed:    `${label} completado para tu cliente`,
      failed:       `${label} falló: ${detail ?? 'error desconocido'}`,
      needs_review: `${label} necesita revisión humana: ${detail ?? ''}`,
    };
    await db.from('worker_notifications').insert({
      type:       event === 'failed' ? 'agent_error' : event === 'needs_review' ? 'needs_review' : 'agent_done',
      message:    msgs[event] ?? label,
      brand_id:   job.brand_id,
      read:       false,
      metadata:   { job_id: job.id, agent: label, event },
    });
  } catch { /* non-blocking */ }
}

// ─── Stats accumulator (shared across parallel BullMQ jobs in one cron tick) ─

interface Stats {
  done: number; errored: number; retried: number; needsReview: number; unhandled: number;
}
let _stats: Stats = { done: 0, errored: 0, retried: 0, needsReview: 0, unhandled: 0 };
let _claimed = 0;

function resetStats() {
  _stats   = { done: 0, errored: 0, retried: 0, needsReview: 0, unhandled: 0 };
  _claimed = 0;
}

// ─── Core processor (shared between BullMQ and Supabase-fallback paths) ──────

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
    p.then((v) => { clearTimeout(timer); resolve(v); })
     .catch((e) => { clearTimeout(timer); reject(e); });
  });
}

async function processJob(job: AgentJob): Promise<void> {
  const handler = lookupHandler(job.agent_type, job.action);
  if (!handler) {
    await finalizeJob(job.id, 'error', `No handler for ${job.agent_type}:${job.action}`);
    _stats.unhandled++;
    return;
  }

  let result: HandlerResult;
  try {
    result = await withTimeout(
      handler(job),
      timeoutForJob(job),
      `${job.agent_type}:${job.action}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (job.attempts < job.max_attempts) {
      await releaseJobForRetry(job.id, msg);
      _stats.retried++;
    } else {
      await finalizeJob(job.id, 'error', msg);
      _stats.errored++;
    }
    // Re-throw so BullMQ also records the failure (triggers its own retry/backoff)
    throw err;
  }

  try {
    switch (result.type) {
      case 'ok': {
        if (result.outputs?.length) await saveOutputs(job, result.outputs);
        if (result.sub_jobs?.length) await queueSubJobs(job, result.sub_jobs);
        await finalizeJob(job.id, 'done');
        void notifyJobEvent(job, 'completed');
        void logAgentAction(`${job.agent_type}:${job.action}`, 'generate', 'agent_job',
          `${job.agent_type}:${job.action} completado`, { resource_id: job.id, brand_id: job.brand_id ?? undefined });
        _stats.done++;
        break;
      }
      case 'needs_review': {
        if (result.outputs?.length) await saveOutputs(job, result.outputs);
        await finalizeJob(job.id, 'needs_review', result.reason);
        void notifyJobEvent(job, 'needs_review', result.reason);
        _stats.needsReview++;
        break;
      }
      case 'retry': {
        if (job.attempts < job.max_attempts) {
          await releaseJobForRetry(job.id, result.error);
          _stats.retried++;
        } else {
          await finalizeJob(job.id, 'error', `Max retries: ${result.error}`);
          _stats.errored++;
        }
        // Re-throw so BullMQ also retries via its backoff schedule
        throw new Error(result.error);
      }
      case 'fail': {
        await finalizeJob(job.id, 'error', result.error);
        void notifyJobEvent(job, 'failed', result.error);
        void logAgentAction(`${job.agent_type}:${job.action}`, 'update', 'agent_job',
          `${job.agent_type}:${job.action} falló: ${result.error?.slice(0, 100)}`,
          { resource_id: job.id, brand_id: job.brand_id ?? undefined, severity: 'warning' });
        _stats.errored++;
        throw new Error(result.error); // BullMQ marks job as failed
      }
    }
  } catch (err) {
    // Persistence failure
    const msg = err instanceof Error ? err.message : String(err);
    await finalizeJob(job.id, 'error', `Persist failure: ${msg}`).catch(() => null);
    _stats.errored++;
    throw err;
  }
}

// ─── BullMQ processor (receives BullMQ job, loads Supabase row, dispatches) ──

async function bullProcessor(bullJob: BullJob<AgentBullJob>): Promise<void> {
  _claimed++;
  const { agent_job_id } = bullJob.data;

  const db = createAdminClient() as DB;
  const { data: row } = await db
    .from('agent_jobs')
    .select('*')
    .eq('id', agent_job_id)
    .maybeSingle();

  if (!row) {
    // Job deleted or never existed — discard silently
    return;
  }
  const job = row as AgentJob;

  // Skip jobs already processed by another runner instance or claimed manually
  if (job.status === 'done' || job.status === 'error' || job.status === 'cancelled' || job.status === 'claimed') {
    return;
  }

  // Mark as running in Supabase
  await db
    .from('agent_jobs')
    .update({ status: 'running', started_at: new Date().toISOString(), attempts: (job.attempts ?? 0) + 1 })
    .eq('id', agent_job_id)
    .eq('status', 'pending'); // only claim if still pending (optimistic lock)

  // Reload with updated attempts count
  const updatedJob: AgentJob = {
    ...job,
    status:     'running',
    attempts:   (job.attempts ?? 0) + 1,
    started_at: new Date().toISOString(),
  };

  await processJob(updatedJob);
}

// ─── Supabase fallback (used when Redis is unavailable) ──────────────────────

async function runSupabaseFallback(batchSize: number): Promise<void> {
  const claimed = await claimJobs(batchSize);
  _claimed = claimed.length;
  await Promise.allSettled(claimed.map(processJob));
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Run a single cron tick.
 *   1. Try BullMQ (drain queue for DRAIN_DURATION_MS).
 *   2. If Redis is unavailable, fall back to Supabase polling (original behaviour).
 */
export async function runOnce(batchSize = DEFAULT_BATCH_SIZE): Promise<RunnerResult> {
  const t0 = Date.now();
  resetStats();

  let source: RunnerResult['source'] = 'bullmq';

  try {
    const worker = createAgentWorker(bullProcessor, batchSize);

    // Run the worker for DRAIN_DURATION_MS then close gracefully
    await new Promise<void>((resolve) => {
      worker.run();

      const stopTimer = setTimeout(async () => {
        // Close the worker: waits for in-flight jobs to finish, then exits
        await worker.close().catch(() => null);
        resolve();
      }, DRAIN_DURATION_MS);

      worker.on('error', (err) => {
        console.error('[runner] BullMQ worker error:', err.message);
        Sentry.captureException(err, { tags: { component: 'agent-runner' } });
      });

      worker.on('closed', () => {
        clearTimeout(stopTimer);
        resolve();
      });
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Redis down or BullMQ init failed → fall back to Supabase polling
    if (/REDIS_URL|ECONNREFUSED|ENOTFOUND|connect/i.test(msg)) {
      console.warn('[runner] BullMQ unavailable, falling back to Supabase polling:', msg);
      source = 'supabase_fallback';
      await runSupabaseFallback(batchSize);
    } else {
      console.error('[runner] Unexpected runner error:', msg);
      Sentry.captureException(err, { tags: { component: 'agent-runner', phase: 'unexpected' } });
    }
  }

  // Even on BullMQ path, check for any jobs in Supabase that weren't dispatched
  // to Redis (e.g., created before Redis was available, or enqueue failures).
  if (source === 'bullmq') {
    try {
      const orphans = await claimJobs(batchSize);
      if (orphans.length > 0) {
        console.log(`[runner] Processing ${orphans.length} Supabase-only jobs`);
        _claimed += orphans.length;
        await Promise.allSettled(orphans.map(processJob));
      }
    } catch { /* non-critical */ }
  }

  return {
    claimed:     _claimed,
    done:        _stats.done,
    errored:     _stats.errored,
    retried:     _stats.retried,
    needsReview: _stats.needsReview,
    unhandled:   _stats.unhandled,
    elapsedMs:   Date.now() - t0,
    source,
  };
}
