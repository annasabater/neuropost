// =============================================================================
// Agent runner
// =============================================================================
// Pulls a batch of pending jobs, dispatches each to its registered handler,
// and persists outputs / sub-jobs / status transitions. Invoked by the cron
// at /api/cron/agent-queue-runner once a minute.
//
// Concurrency: jobs in a batch run in parallel (Promise.allSettled). The
// claim step uses SELECT ... FOR UPDATE SKIP LOCKED so running multiple
// runner instances (e.g. several cron ticks overlapping) is safe.

import {
  claimJobs,
  saveOutputs,
  queueSubJobs,
  finalizeJob,
  releaseJobForRetry,
} from './queue';
import { lookupHandler } from './registry';
import type { AgentJob, HandlerResult } from './types';

export interface RunnerResult {
  claimed:    number;
  done:       number;
  errored:    number;
  retried:    number;
  needsReview: number;
  unhandled:  number;
  elapsedMs:  number;
}

const DEFAULT_BATCH_SIZE = 10;
const HANDLER_TIMEOUT_MS = 45_000; // well under Vercel's 300s cap

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(timer); resolve(v); })
     .catch((e) => { clearTimeout(timer); reject(e); });
  });
}

/**
 * Process a single job end-to-end. Catches every error so one bad job never
 * poisons the whole batch.
 */
async function processJob(job: AgentJob): Promise<Pick<RunnerResult, 'done' | 'errored' | 'retried' | 'needsReview' | 'unhandled'>> {
  const stats = { done: 0, errored: 0, retried: 0, needsReview: 0, unhandled: 0 };

  const handler = lookupHandler(job.agent_type, job.action);
  if (!handler) {
    await finalizeJob(job.id, 'error', `No handler registered for ${job.agent_type}:${job.action}`);
    stats.unhandled = 1;
    return stats;
  }

  let result: HandlerResult;
  try {
    result = await withTimeout(handler(job), HANDLER_TIMEOUT_MS, `${job.agent_type}:${job.action}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (job.attempts < job.max_attempts) {
      await releaseJobForRetry(job.id, msg);
      stats.retried = 1;
    } else {
      await finalizeJob(job.id, 'error', msg);
      stats.errored = 1;
    }
    return stats;
  }

  try {
    switch (result.type) {
      case 'ok': {
        if (result.outputs?.length) await saveOutputs(job, result.outputs);
        if (result.sub_jobs?.length) await queueSubJobs(job, result.sub_jobs);
        await finalizeJob(job.id, 'done');
        stats.done = 1;
        break;
      }
      case 'needs_review': {
        if (result.outputs?.length) await saveOutputs(job, result.outputs);
        await finalizeJob(job.id, 'needs_review', result.reason);
        stats.needsReview = 1;
        break;
      }
      case 'retry': {
        if (job.attempts < job.max_attempts) {
          await releaseJobForRetry(job.id, result.error);
          stats.retried = 1;
        } else {
          await finalizeJob(job.id, 'error', `Max retries exceeded: ${result.error}`);
          stats.errored = 1;
        }
        break;
      }
      case 'fail': {
        await finalizeJob(job.id, 'error', result.error);
        stats.errored = 1;
        break;
      }
    }
  } catch (err) {
    // Persistence layer failure: best-effort mark errored, don't retry in this tick.
    const msg = err instanceof Error ? err.message : String(err);
    await finalizeJob(job.id, 'error', `Persist failure: ${msg}`).catch(() => null);
    stats.errored = 1;
  }

  return stats;
}

/**
 * Run a single tick: claim up to `batchSize` jobs and process them in parallel.
 */
export async function runOnce(batchSize = DEFAULT_BATCH_SIZE): Promise<RunnerResult> {
  const t0 = Date.now();

  const claimed = await claimJobs(batchSize);
  if (claimed.length === 0) {
    return {
      claimed: 0, done: 0, errored: 0, retried: 0, needsReview: 0, unhandled: 0,
      elapsedMs: Date.now() - t0,
    };
  }

  const results = await Promise.allSettled(claimed.map(processJob));

  const agg = { done: 0, errored: 0, retried: 0, needsReview: 0, unhandled: 0 };
  for (const r of results) {
    if (r.status === 'fulfilled') {
      agg.done        += r.value.done;
      agg.errored     += r.value.errored;
      agg.retried     += r.value.retried;
      agg.needsReview += r.value.needsReview;
      agg.unhandled   += r.value.unhandled;
    } else {
      // processJob itself should never throw, but count it if it does.
      agg.errored += 1;
    }
  }

  return {
    claimed: claimed.length,
    ...agg,
    elapsedMs: Date.now() - t0,
  };
}
