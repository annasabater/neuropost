// =============================================================================
// BullMQ — Queue and Worker factory
// =============================================================================
// Single source of truth for queue names, job data shapes, and connection
// reuse. Import getAgentQueue() to enqueue, createAgentWorker() to process.
//
// Architecture:
//   • BullMQ Queue is the dispatch layer (fast, Redis-backed).
//   • Supabase agent_jobs is the persistence / audit layer.
//   • BullMQ jobs carry only the Supabase job ID — lightweight.
//   • The BullMQ Worker fetches the full job from Supabase, runs the handler,
//     and writes results back to Supabase.
//   • Priority: 0 = highest in BullMQ (inverted from our 0-100 scale).
//     We map: bullmq_priority = 100 - supabase_priority.

import { Queue, Worker, type Processor } from 'bullmq';
import { getBullMQConnection } from './redis';

// ─── Constants ────────────────────────────────────────────────────────────────

export const AGENT_QUEUE_NAME = 'agent-jobs';

/** Seconds a completed/failed job is kept in Redis before auto-cleanup. */
const COMPLETED_JOB_TTL_S = 60 * 60 * 24;     // 24 h
const FAILED_JOB_TTL_S    = 60 * 60 * 24 * 7; // 7 d

// ─── Job data shape ───────────────────────────────────────────────────────────

/** The only data stored inside a BullMQ job — everything else lives in Supabase. */
export interface AgentBullJob {
  /** Supabase agent_jobs.id — the worker uses this to load the full job. */
  agent_job_id: string;
}

// ─── Queue ────────────────────────────────────────────────────────────────────

let _queue: Queue<AgentBullJob> | null = null;

export function getAgentQueue(): Queue<AgentBullJob> {
  if (!_queue) {
    _queue = new Queue<AgentBullJob>(AGENT_QUEUE_NAME, {
      connection: getBullMQConnection(),
      defaultJobOptions: {
        removeOnComplete: { age: COMPLETED_JOB_TTL_S },
        removeOnFail:     { age: FAILED_JOB_TTL_S    },
        attempts:         3,
        backoff: {
          type:  'exponential',
          delay: 5_000, // 5s → 10s → 20s
        },
      },
    });
  }
  return _queue;
}

// ─── Worker ───────────────────────────────────────────────────────────────────

/**
 * Create a BullMQ Worker that processes agent jobs.
 * The worker is created with autorun: false — call worker.run() to start.
 *
 * @param processor   The async function that handles each BullMQ job.
 * @param concurrency Max jobs processed in parallel (default 10).
 */
export function createAgentWorker(
  processor: Processor<AgentBullJob>,
  concurrency = 10,
): Worker<AgentBullJob> {
  return new Worker<AgentBullJob>(AGENT_QUEUE_NAME, processor, {
    connection:  getBullMQConnection(),
    concurrency,
    autorun:     false,
    // BullMQ's default stalledInterval is 30s — every tick triggers several
    // Redis calls. With a 1-minute cron runner this accounts for the bulk of
    // our Upstash traffic. Raising it to 2min cuts idle polling ~75% while
    // still recovering stalled jobs well within acceptable latency.
    settings: { stalledInterval: 120_000 },
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert our 0-100 priority scale (higher = more urgent) to BullMQ's scale
 * (lower number = higher priority, 1 is highest, undefined = normal).
 */
export function toBullPriority(supabasePriority: number): number {
  // BullMQ priority range: 1 (highest) to MAX_INT (lowest)
  // We map 100 → 1, 0 → 100
  return Math.max(1, 101 - Math.min(supabasePriority, 100));
}
