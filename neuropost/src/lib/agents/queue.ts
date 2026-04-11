// =============================================================================
// Agent queue — thin wrapper over the agent_jobs table
// =============================================================================
// The only module that knows how to insert/read jobs. API routes and agents
// must call these helpers instead of touching the table directly — this is
// what keeps the orchestration contract honest.
//
// All reads/writes use the admin client. RLS on agent_jobs protects
// client-side reads; server-side code is already authenticated by the route.

import { createAdminClient } from '@/lib/supabase';
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
 * Enqueue a new agent job. Returns the created job row.
 */
export async function queueJob(input: QueueJobInput): Promise<AgentJob> {
  const db = createAdminClient() as DB;

  const row = {
    brand_id:      input.brand_id ?? null,
    agent_type:    input.agent_type,
    action:        input.action,
    input:         input.input ?? {},
    priority:      input.priority ?? 50,
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
  return data as AgentJob;
}

/**
 * Enqueue many sub-jobs at once (used by handlers that return sub_jobs).
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
  return (data ?? []) as AgentJob[];
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
