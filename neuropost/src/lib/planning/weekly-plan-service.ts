// =============================================================================
// Planning — WeeklyPlan service
// =============================================================================
// Creates and transitions weekly_plans + content_ideas.
// Used from:
//   - src/lib/agents/strategy/plan-week.ts  (live pipeline)
//   - scripts/backfill_weekly_plans.ts       (retroactive backfill)
//
// All writes use the admin client (service role). Never called from browser.

import { createAdminClient }         from '@/lib/supabase';
import { parseIdeasFromStrategyPayload } from './parse-ideas';
import type { ParsedIdea }           from './parse-ideas';
import type { WeeklyPlan, WeeklyPlanStatus, ContentIdea } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

// ─── Errors ───────────────────────────────────────────────────────────────────

/**
 * Thrown by transitionWeeklyPlanStatus when another concurrent process changed
 * the plan's status between our SELECT and our UPDATE. The atomic UPDATE with
 * `WHERE status=$expected` returns 0 rows, which we detect and surface so
 * callers can decide whether to retry, return 409, or log-and-continue.
 */
export class ConcurrentPlanModificationError extends Error {
  constructor(
    public readonly planId:   string,
    public readonly expected: string,
    public readonly actual:   string,
  ) {
    super(
      `Plan ${planId}: concurrent modification detected. ` +
      `Expected status '${expected}', found '${actual}'`,
    );
    this.name = 'ConcurrentPlanModificationError';
  }
}

// ─── Status machine ───────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Partial<Record<WeeklyPlanStatus, WeeklyPlanStatus[]>> = {
  generating:        ['ideas_ready', 'expired'],
  ideas_ready:       ['sent_to_client', 'client_reviewing', 'expired', 'skipped_by_client'],
  sent_to_client:    ['client_reviewing', 'auto_approved', 'expired'],
  client_reviewing:  ['client_approved', 'auto_approved', 'skipped_by_client', 'expired'],
  client_approved:   ['producing'],
  producing:         ['calendar_ready'],
  calendar_ready:    ['completed'],
  auto_approved:     ['producing'],
  skipped_by_client: ['expired'],
  completed:         [],
  expired:           [],
};

function assertValidTransition(from: WeeklyPlanStatus, to: WeeklyPlanStatus): void {
  const allowed = VALID_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(
      `[weekly-plan-service] Invalid status transition: ${from} → ${to}. Allowed: [${allowed.join(', ')}]`,
    );
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface CreateWeeklyPlanParams {
  brand_id:         string;
  agent_output_id:  string | null;    // null when called from live pipeline (output not yet saved)
  week_start:       string;           // YYYY-MM-DD (Monday)
  parent_job_id:    string | null;    // agent_job.id that triggered this plan
  /**
   * Pre-parsed ideas. If provided, used directly.
   * If omitted AND agent_output_id is set, the payload is loaded from DB.
   */
  ideas?:           ParsedIdea[];
}

export interface CreateWeeklyPlanResult {
  plan:    WeeklyPlan;
  ideas:   ContentIdea[];
  created: boolean;          // false = plan already existed (idempotent)
}

/**
 * Idempotent: if a weekly_plan already exists for (brand_id, week_start),
 * returns it without touching content_ideas.
 *
 * If created fresh, writes weekly_plans (status='generating') +
 * content_ideas atomically via the create_weekly_plan_atomic Postgres RPC.
 * No manual rollback needed — the DB transaction covers both tables.
 */
export async function createWeeklyPlanFromOutput(
  params: CreateWeeklyPlanParams,
): Promise<CreateWeeklyPlanResult> {
  const db = createAdminClient() as DB;

  // ── Resolve parsed ideas before the RPC call ─────────────────────────────
  let parsedIdeas: ParsedIdea[] = params.ideas ?? [];

  if (parsedIdeas.length === 0 && params.agent_output_id) {
    const { data: output } = await db
      .from('agent_outputs')
      .select('payload')
      .eq('id', params.agent_output_id)
      .maybeSingle();

    if (output?.payload) {
      parsedIdeas = parseIdeasFromStrategyPayload(output.payload);
    }
  }

  // ── Atomic RPC: INSERT weekly_plan + INSERT content_ideas in one tx ───────
  const { data: result, error: rpcErr } = await db.rpc('create_weekly_plan_atomic', {
    p_brand_id:        params.brand_id,
    p_week_start:      params.week_start,
    p_parent_job_id:   params.parent_job_id ?? null,
    p_agent_output_id: params.agent_output_id ?? null,
    p_ideas:           parsedIdeas,
  });

  if (rpcErr || !result) {
    throw new Error(`[weekly-plan-service] create_weekly_plan_atomic failed: ${rpcErr?.message}`);
  }

  return {
    plan:    result.plan    as WeeklyPlan,
    ideas:   (result.ideas  ?? []) as ContentIdea[],
    created: result.created as boolean,
  };
}

/**
 * Transition a weekly_plan to a new status.
 * Validates against the status machine and throws on invalid transitions.
 */
export async function transitionWeeklyPlanStatus(params: {
  plan_id: string;
  to:      WeeklyPlanStatus;
  reason?: string;
}): Promise<WeeklyPlan> {
  const db = createAdminClient() as DB;

  // Load current status
  const { data: current, error } = await db
    .from('weekly_plans')
    .select('*')
    .eq('id', params.plan_id)
    .single();

  if (error || !current) {
    throw new Error(`[weekly-plan-service] Plan not found: ${params.plan_id}`);
  }

  assertValidTransition(current.status as WeeklyPlanStatus, params.to);

  // Extra timestamps for specific transitions
  const extra: Record<string, unknown> = {};
  if (params.to === 'sent_to_client')    extra.sent_to_client_at    = new Date().toISOString();
  if (params.to === 'client_approved')   extra.client_approved_at   = new Date().toISOString();
  if (params.to === 'auto_approved')     { extra.auto_approved = true; extra.auto_approved_at = new Date().toISOString(); }

  // P20: atomic transition — WHERE status=$expected so a concurrent modification
  // leaves 0 rows affected. .maybeSingle() returns data=null rather than throwing
  // so we can distinguish "no row matched" from "real DB error".
  const { data: updated, error: updateErr } = await db
    .from('weekly_plans')
    .update({ status: params.to, ...extra })
    .eq('id', params.plan_id)
    .eq('status', current.status as string)
    .select()
    .maybeSingle();

  if (updateErr) {
    throw new Error(`[weekly-plan-service] Status transition failed: ${updateErr.message}`);
  }

  if (!updated) {
    // 0 rows matched → status changed between our SELECT and UPDATE.
    // Re-read the real current status to give the caller useful context.
    const { data: latest } = await db
      .from('weekly_plans')
      .select('status')
      .eq('id', params.plan_id)
      .maybeSingle();
    const actualStatus = (latest?.status as string | undefined) ?? 'unknown';
    throw new ConcurrentPlanModificationError(
      params.plan_id,
      current.status as string,
      actualStatus,
    );
  }

  if (params.reason) {
    console.log(`[weekly-plan-service] ${params.plan_id}: ${current.status} → ${params.to} (${params.reason})`);
  } else {
    console.log(`[weekly-plan-service] ${params.plan_id}: ${current.status} → ${params.to}`);
  }

  return updated as WeeklyPlan;
}
