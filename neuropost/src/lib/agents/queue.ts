// =============================================================================
// Agent queue — dual-write: Supabase (persistence) + BullMQ (dispatch)
// =============================================================================
// The only module that knows how to insert/read jobs. API routes and agents
// must call these helpers instead of touching the table directly — this is
// what keeps the orchestration contract honest.
//
// Flow:
//   queueJob() → INSERT into Supabase (source of truth + UI) →
//                add to BullMQ Queue (Redis, for fast dispatch)
//
// The BullMQ job carries only the Supabase job ID. The worker loads the full
// job from Supabase when it picks it up. This keeps Redis jobs tiny and
// Supabase as the single source of truth for status/outputs/audit trail.

import { createAdminClient } from '@/lib/supabase';
import { getAgentQueue, toBullPriority } from '@/lib/bullmq';
import type {
  AgentJob,
  AgentOutput,
  QueueJobInput,
  HandlerOutput,
  HandlerSubJob,
  AgentJobStatus,
} from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

/**
 * Enqueue a new agent job.
 * Writes to Supabase (persistence) then adds to BullMQ Queue (dispatch).
 * Returns the created Supabase job row.
 */
export async function queueJob(input: QueueJobInput): Promise<AgentJob> {
  const db = createAdminClient() as DB;

  const priority = input.priority ?? 50;

  const row = {
    brand_id:      input.brand_id ?? null,
    agent_type:    input.agent_type,
    action:        input.action,
    input:         input.input ?? {},
    priority,
    max_attempts:  input.max_attempts ?? 3,
    requested_by:  input.requested_by ?? 'client',
    requester_id:  input.requester_id ?? null,
    parent_job_id: input.parent_job_id ?? null,
    scheduled_for: input.scheduled_for ?? null,
    status:        'pending' as AgentJobStatus,
  };

  const { data, error } = await db
    .from('agent_jobs')
    .insert(row)
    .select()
    .single();

  if (error) throw new Error(`queueJob: ${error.message}`);
  const job = data as AgentJob;

  // Push to BullMQ for fast dispatch (non-blocking — Supabase is the source of truth)
  try {
    const queue = getAgentQueue();
    // Calculate BullMQ delay from scheduled_for (milliseconds from now)
    const delay = input.scheduled_for
      ? Math.max(0, new Date(input.scheduled_for).getTime() - Date.now())
      : undefined;

    await queue.add(
      `${input.agent_type}:${input.action}`,
      { agent_job_id: job.id },
      {
        jobId:    `supabase:${job.id}`,   // idempotency key
        priority: toBullPriority(priority),
        delay,
      },
    );
  } catch (redisErr) {
    // Redis failure must NOT block the caller — Supabase job already exists
    // and the cron fallback can still pick it up.
    console.error('[queueJob] BullMQ enqueue failed (job still in Supabase):', redisErr);
  }

  return job;
}

/**
 * Enqueue many sub-jobs at once (used by handlers that return sub_jobs).
 * Writes all to Supabase in one batch, then pushes each to BullMQ.
 */
export async function queueSubJobs(
  parentJob: AgentJob,
  subJobs: HandlerSubJob[],
): Promise<AgentJob[]> {
  if (!subJobs.length) return [];
  const db = createAdminClient() as DB;

  const rows = subJobs.map((s) => ({
    brand_id:      parentJob.brand_id,
    agent_type:    s.agent_type,
    action:        s.action,
    input:         s.input ?? {},
    priority:      s.priority ?? parentJob.priority,
    max_attempts:  3,
    requested_by:  'agent' as const,
    requester_id:  parentJob.requester_id,
    parent_job_id: parentJob.id,
    scheduled_for: s.scheduled_for ?? null,
    status:        'pending' as AgentJobStatus,
  }));

  const { data, error } = await db
    .from('agent_jobs')
    .insert(rows)
    .select();

  if (error) throw new Error(`queueSubJobs: ${error.message}`);
  const inserted = (data ?? []) as AgentJob[];

  // Push all sub-jobs to BullMQ in bulk
  try {
    const queue = getAgentQueue();
    const bullJobs = inserted.map((job, i) => {
      const sub = subJobs[i];
      const delay = sub.scheduled_for
        ? Math.max(0, new Date(sub.scheduled_for).getTime() - Date.now())
        : undefined;
      return {
        name:    `${job.agent_type}:${job.action}`,
        data:    { agent_job_id: job.id },
        opts: {
          jobId:    `supabase:${job.id}`,
          priority: toBullPriority(sub.priority ?? parentJob.priority ?? 50),
          delay,
        },
      };
    });
    await queue.addBulk(bullJobs);
  } catch (redisErr) {
    console.error('[queueSubJobs] BullMQ bulk enqueue failed (jobs still in Supabase):', redisErr);
  }

  return inserted;
}

/**
 * Persist a batch of outputs for a job.
 */
export async function saveOutputs(
  job: AgentJob,
  outputs: HandlerOutput[],
): Promise<AgentOutput[]> {
  if (!outputs.length) return [];
  const db = createAdminClient() as DB;

  const rows = outputs.map((o) => ({
    job_id:      job.id,
    brand_id:    job.brand_id,
    kind:        o.kind,
    payload:     o.payload,
    preview_url: o.preview_url ?? null,
    cost_usd:    o.cost_usd ?? null,
    tokens_used: o.tokens_used ?? null,
    model:       o.model ?? null,
  }));

  const { data, error } = await db
    .from('agent_outputs')
    .insert(rows)
    .select();

  if (error) throw new Error(`saveOutputs: ${error.message}`);
  return (data ?? []) as AgentOutput[];
}

/**
 * Mark a job as finished (done / error / needs_review / cancelled).
 */
export async function finalizeJob(
  jobId: string,
  status: Exclude<AgentJobStatus, 'pending' | 'running'>,
  error?: string,
): Promise<void> {
  const db = createAdminClient() as DB;

  await db
    .from('agent_jobs')
    .update({
      status,
      finished_at: new Date().toISOString(),
      error: error ?? null,
    })
    .eq('id', jobId);
}

/**
 * Return a job to pending so it can be retried on the next runner tick.
 * Used when a handler returns `type: 'retry'` and attempts < max_attempts.
 */
export async function releaseJobForRetry(jobId: string, error: string): Promise<void> {
  const db = createAdminClient() as DB;

  await db
    .from('agent_jobs')
    .update({
      status: 'pending' as AgentJobStatus,
      started_at: null,
      error,
    })
    .eq('id', jobId);
}

/**
 * Claim a batch of pending jobs atomically.
 * Uses the claim_agent_jobs SQL function with FOR UPDATE SKIP LOCKED so
 * multiple runner instances never grab the same job.
 */
export async function claimJobs(limit = 10): Promise<AgentJob[]> {
  const db = createAdminClient() as DB;

  const { data, error } = await db.rpc('claim_agent_jobs', { p_limit: limit });
  if (error) throw new Error(`claimJobs: ${error.message}`);
  return (data ?? []) as AgentJob[];
}

/**
 * Fetch a single job with its outputs (for GET /api/agent-jobs/:id).
 */
export async function getJobWithOutputs(
  jobId: string,
): Promise<{ job: AgentJob; outputs: AgentOutput[] } | null> {
  const db = createAdminClient() as DB;

  const { data: job } = await db
    .from('agent_jobs')
    .select('*')
    .eq('id', jobId)
    .single();
  if (!job) return null;

  const { data: outputs } = await db
    .from('agent_outputs')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });

  return { job: job as AgentJob, outputs: (outputs ?? []) as AgentOutput[] };
}

/**
 * List recent jobs for a brand (used by the client dashboard feed).
 */
export async function listJobsByBrand(
  brandId: string,
  opts: { status?: AgentJobStatus; limit?: number } = {},
): Promise<AgentJob[]> {
  const db = createAdminClient() as DB;

  let q = db
    .from('agent_jobs')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 50);

  if (opts.status) q = q.eq('status', opts.status);

  const { data, error } = await q;
  if (error) throw new Error(`listJobsByBrand: ${error.message}`);
  return (data ?? []) as AgentJob[];
}

/**
 * Cancel a pending job. No-op if the job is already running or terminal.
 */
export async function cancelJob(jobId: string): Promise<boolean> {
  const db = createAdminClient() as DB;

  const { data, error } = await db
    .from('agent_jobs')
    .update({ status: 'cancelled' as AgentJobStatus, finished_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (error) throw new Error(`cancelJob: ${error.message}`);
  return Boolean(data);
}
