// =============================================================================
// Agent orchestrator v2 — intent-aware
// =============================================================================
// THE single entry point for all agent work. Two modes:
//
//   1. Intent mode (recommended):
//      { intent: 'create_reel', input: { topic: 'rutina piernas' } }
//      → resolves to a deterministic list of steps → queues each
//
//   2. Direct mode (backwards-compatible, for internal/cron use):
//      { agent_type: 'content', action: 'generate_caption', input: {...} }
//      → validates handler exists, plan gate, queue
//
// All jobs pass through the same pipeline:
//   handler exists? → brand exists? → in-flight cap → plan gate → queue
//
// Intent mode adds a "group job" wrapper: all steps share parent_job_id so
// the UI can show "Crear reel — 2/3 steps done" and cancel the whole group.

import '@/lib/agents/handlers';

import { queueJob } from './queue';
import { lookupHandler } from './registry';
import { checkActionAllowed } from './plan-gate';
import { resolveIntent } from './intents';
import { createAdminClient } from '@/lib/supabase';
import type { AgentJob, AgentType, AgentJobRequester } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

const MAX_ACTIVE_JOBS_PER_BRAND = 30;

// =============================================================================
// Public types
// =============================================================================

/** Direct mode (backwards-compatible) */
export interface OrchestrateDirectInput {
  brand_id:       string;
  agent_type:     AgentType;
  action:         string;
  input?:         Record<string, unknown>;
  priority?:      number;
  scheduled_for?: string;
  requested_by?:  AgentJobRequester;
  requester_id?:  string | null;
  parent_job_id?: string | null;
}

/** Intent mode (new default for frontend) */
export interface OrchestrateIntentInput {
  brand_id:       string;
  intent:         string;
  input?:         Record<string, unknown>;
  requested_by?:  AgentJobRequester;
  requester_id?:  string | null;
}

export type OrchestrateInput = OrchestrateDirectInput | OrchestrateIntentInput;

export type OrchestrateResult =
  | { ok: true;  jobs: AgentJob[] }
  | { ok: false; status: 400 | 402 | 404 | 429; error: string; upgradeUrl?: string };

// =============================================================================
// Shared validation
// =============================================================================

async function validateBrandAndCap(
  brandId: string,
): Promise<{ ok: true } | { ok: false; status: 404 | 429; error: string }> {
  const db = createAdminClient() as DB;

  const { data: brand } = await db
    .from('brands').select('id').eq('id', brandId).maybeSingle();
  if (!brand) return { ok: false, status: 404, error: 'Brand not found' };

  const { count } = await db
    .from('agent_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brandId)
    .in('status', ['pending', 'running']);

  if ((count ?? 0) >= MAX_ACTIVE_JOBS_PER_BRAND) {
    return {
      ok: false,
      status: 429,
      error: `Demasiados jobs activos (${count}/${MAX_ACTIVE_JOBS_PER_BRAND}).`,
    };
  }

  return { ok: true };
}

// =============================================================================
// Direct mode
// =============================================================================

async function orchestrateDirect(input: OrchestrateDirectInput): Promise<OrchestrateResult> {
  const handler = lookupHandler(input.agent_type, input.action);
  if (!handler) {
    return { ok: false, status: 400, error: `No handler for ${input.agent_type}:${input.action}` };
  }

  const v = await validateBrandAndCap(input.brand_id);
  if (!v.ok) return v;

  const gate = await checkActionAllowed(input.brand_id, input.agent_type, input.action);
  if (!gate.allowed) {
    return { ok: false, status: 402, error: gate.reason ?? 'Plan limit', upgradeUrl: gate.upgradeUrl };
  }

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

  return { ok: true, jobs: [job] };
}

// =============================================================================
// Intent mode
// =============================================================================

async function orchestrateIntent(input: OrchestrateIntentInput): Promise<OrchestrateResult> {
  const definition = resolveIntent(input.intent);
  if (!definition) {
    return { ok: false, status: 400, error: `Unknown intent: ${input.intent}` };
  }

  const v = await validateBrandAndCap(input.brand_id);
  if (!v.ok) return v;

  // Pre-validate plan gates for ALL steps before queueing anything.
  // This prevents partial execution: either the whole intent passes or nothing.
  for (const step of definition.steps) {
    const gate = await checkActionAllowed(input.brand_id, step.agent_type, step.action);
    if (!gate.allowed) {
      return {
        ok: false,
        status: 402,
        error: `${definition.label}: ${gate.reason ?? 'Plan limit'}`,
        upgradeUrl: gate.upgradeUrl,
      };
    }
  }

  // If grouped, create a lightweight "intent parent" job that holds the
  // label. The sub-steps run as children. This gives the UI a single entry
  // to display + cancel.
  let parentJobId: string | null = null;
  const allJobs: AgentJob[] = [];

  if (definition.grouped && definition.steps.length > 1) {
    const parent = await queueJob({
      brand_id:     input.brand_id,
      agent_type:   definition.steps[0].agent_type,
      action:       `intent:${input.intent}`,
      input:        { _intent: input.intent, _label: definition.label, ...input.input },
      priority:     definition.steps[0].priority ?? 60,
      requested_by: input.requested_by ?? 'client',
      requester_id: input.requester_id,
      // The parent job has no real handler — the runner will mark it as
      // 'error: No handler'. To avoid that, we mark it 'done' immediately.
      // It only exists as a grouping anchor.
    });
    parentJobId = parent.id;
    allJobs.push(parent);

    // Immediately finalize the parent (it's just a label).
    const db = createAdminClient() as DB;
    await db.from('agent_jobs').update({
      status: 'done',
      finished_at: new Date().toISOString(),
    }).eq('id', parent.id);
  }

  // Queue each step.
  for (const step of definition.steps) {
    const mergedInput = { ...input.input, ...(step.extra_input ?? {}) };
    const job = await queueJob({
      brand_id:      input.brand_id,
      agent_type:    step.agent_type,
      action:        step.action,
      input:         mergedInput,
      priority:      step.priority ?? 60,
      requested_by:  input.requested_by ?? 'client',
      requester_id:  input.requester_id,
      parent_job_id: parentJobId,
    });
    allJobs.push(job);
  }

  return { ok: true, jobs: allJobs };
}

// =============================================================================
// Unified entry point
// =============================================================================

function isIntentInput(input: OrchestrateInput): input is OrchestrateIntentInput {
  return 'intent' in input && typeof (input as OrchestrateIntentInput).intent === 'string';
}

export async function orchestrateJob(input: OrchestrateInput): Promise<OrchestrateResult> {
  return isIntentInput(input) ? orchestrateIntent(input) : orchestrateDirect(input);
}

// Re-export for backwards compatibility — old callers expected { ok, job }
// with a single job. New callers should use `jobs`.
export type OrchestrateResultCompat =
  | { ok: true;  job: AgentJob; jobs: AgentJob[] }
  | { ok: false; status: 400 | 402 | 404 | 429; error: string; upgradeUrl?: string };
