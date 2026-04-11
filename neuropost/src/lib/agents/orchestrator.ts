// =============================================================================
// Agent orchestrator
// =============================================================================
// Single entry point for turning a client (or worker) request into a queued
// agent job. Every API route that wants to trigger agent work calls
// `orchestrateJob()` instead of touching queueJob() directly.
//
// Responsibilities:
//   1. Verify the agent_type/action combo has a registered handler.
//   2. Run the plan gate for that action.
//   3. Enforce a simple per-brand rate limit on queued work.
//   4. Call queueJob() and return the row.
//
// Strategy-driven orchestration (client says "dame un post sobre X" and the
// orchestrator explodes it into multiple jobs via the strategy-agent) is
// intentionally NOT implemented here — that's F4. Today callers specify
// (agent_type, action, input) explicitly.

// Import the handlers barrel for its side effects: at module load, every
// backend/local handler is registered. Without this import, lookupHandler()
// would return null for everything.
import '@/lib/agents/handlers';

import { queueJob } from './queue';
import { lookupHandler } from './registry';
import { checkActionAllowed } from './plan-gate';
import { createAdminClient } from '@/lib/supabase';
import type {
  AgentJob,
  AgentType,
  AgentJobRequester,
} from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

// How many "active" jobs (pending OR running) a brand can have in flight.
// Prevents a single brand from flooding the runner for all other tenants.
const MAX_ACTIVE_JOBS_PER_BRAND = 30;

// =============================================================================
// Public types
// =============================================================================

export interface OrchestrateInput {
  brand_id:      string;
  agent_type:    AgentType;
  action:        string;
  input?:        Record<string, unknown>;
  priority?:     number;
  scheduled_for?: string;
  requested_by?: AgentJobRequester;
  requester_id?: string | null;
  parent_job_id?: string | null;
}

export type OrchestrateResult =
  | { ok: true;  job: AgentJob }
  | { ok: false; status: 400 | 402 | 404 | 429; error: string; upgradeUrl?: string };

// =============================================================================
// Orchestration
// =============================================================================

export async function orchestrateJob(input: OrchestrateInput): Promise<OrchestrateResult> {
  // 1. Handler must exist. Otherwise the job would just land in error state
  //    on the next runner tick, which wastes a round-trip.
  const handler = lookupHandler(input.agent_type, input.action);
  if (!handler) {
    return {
      ok: false,
      status: 400,
      error: `No handler registered for ${input.agent_type}:${input.action}`,
    };
  }

  // 2. Brand must exist (admin client so we don't re-check ownership here —
  //    the caller route is already authenticated).
  const db = createAdminClient() as DB;
  const { data: brand } = await db
    .from('brands')
    .select('id')
    .eq('id', input.brand_id)
    .maybeSingle();
  if (!brand) {
    return { ok: false, status: 404, error: 'Brand not found' };
  }

  // 3. Per-brand in-flight cap. Cheap read, protects noisy neighbours.
  const { count } = await db
    .from('agent_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', input.brand_id)
    .in('status', ['pending', 'running']);

  if ((count ?? 0) >= MAX_ACTIVE_JOBS_PER_BRAND) {
    return {
      ok: false,
      status: 429,
      error: `Demasiados jobs activos (${count}/${MAX_ACTIVE_JOBS_PER_BRAND}). Espera a que terminen los actuales o cancela alguno.`,
    };
  }

  // 4. Plan gate.
  const gate = await checkActionAllowed(input.brand_id, input.agent_type, input.action);
  if (!gate.allowed) {
    return {
      ok: false,
      status: 402,
      error: gate.reason ?? 'Plan limit reached',
      upgradeUrl: gate.upgradeUrl,
    };
  }

  // 5. Queue.
  const job = await queueJob({
    brand_id:      input.brand_id,
    agent_type:    input.agent_type,
    action:        input.action,
    input:         input.input,
    priority:      input.priority,
    scheduled_for: input.scheduled_for,
    requested_by:  input.requested_by ?? 'client',
    requester_id:  input.requester_id,
    parent_job_id: input.parent_job_id,
  });

  return { ok: true, job };
}
