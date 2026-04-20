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
 * content_ideas in a manual transaction (rollback on failure).
 */
export async function createWeeklyPlanFromOutput(
  params: CreateWeeklyPlanParams,
): Promise<CreateWeeklyPlanResult> {
  const db = createAdminClient() as DB;

  // ── Idempotency check ────────────────────────────────────────────────────
  const { data: existing } = await db
    .from('weekly_plans')
    .select('*')
    .eq('brand_id', params.brand_id)
    .eq('week_start', params.week_start)
    .maybeSingle();

  if (existing) {
    // Fetch associated ideas for the caller
    const { data: existingIdeas } = await db
      .from('content_ideas')
      .select('*')
      .eq('week_id', existing.id)
      .order('position');

    return {
      plan:    existing as WeeklyPlan,
      ideas:   (existingIdeas ?? []) as ContentIdea[],
      created: false,
    };
  }

  // ── Resolve parsed ideas ─────────────────────────────────────────────────
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

  // ── INSERT weekly_plan (status='generating') ──────────────────────────────
  const { data: plan, error: planErr } = await db
    .from('weekly_plans')
    .insert({
      brand_id:        params.brand_id,
      parent_job_id:   params.parent_job_id,
      week_start:      params.week_start,
      status:          'generating' as WeeklyPlanStatus,
      auto_approved:   false,
      auto_approved_at: null,
    })
    .select()
    .single();

  if (planErr || !plan) {
    throw new Error(`[weekly-plan-service] Failed to insert weekly_plan: ${planErr?.message}`);
  }

  // ── INSERT content_ideas (within manual transaction) ──────────────────────
  if (parsedIdeas.length > 0) {
    const rows = parsedIdeas.map((idea) => ({
      week_id:              plan.id,
      brand_id:             params.brand_id,
      agent_output_id:      params.agent_output_id,
      category_id:          idea.category_id,
      position:             idea.position,
      day_of_week:          idea.day_of_week,
      format:               idea.format,
      angle:                idea.angle,
      hook:                 idea.hook,
      copy_draft:           idea.copy_draft,
      hashtags:             idea.hashtags,
      suggested_asset_url:  idea.suggested_asset_url,
      suggested_asset_id:   idea.suggested_asset_id,
      status:               'pending',
    }));

    const { error: ideasErr } = await db.from('content_ideas').insert(rows);

    if (ideasErr) {
      // Manual rollback: delete the plan so the caller can retry
      await db.from('weekly_plans').delete().eq('id', plan.id);
      throw new Error(`[weekly-plan-service] Failed to insert content_ideas: ${ideasErr.message}`);
    }
  }

  // Fetch back inserted ideas
  const { data: insertedIdeas } = await db
    .from('content_ideas')
    .select('*')
    .eq('week_id', plan.id)
    .order('position');

  return {
    plan:    plan as WeeklyPlan,
    ideas:   (insertedIdeas ?? []) as ContentIdea[],
    created: true,
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

  const { data: updated, error: updateErr } = await db
    .from('weekly_plans')
    .update({ status: params.to, ...extra })
    .eq('id', params.plan_id)
    .select()
    .single();

  if (updateErr || !updated) {
    throw new Error(`[weekly-plan-service] Status transition failed: ${updateErr?.message}`);
  }

  if (params.reason) {
    console.log(`[weekly-plan-service] ${params.plan_id}: ${current.status} → ${params.to} (${params.reason})`);
  } else {
    console.log(`[weekly-plan-service] ${params.plan_id}: ${current.status} → ${params.to}`);
  }

  return updated as WeeklyPlan;
}
