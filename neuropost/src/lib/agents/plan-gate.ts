// =============================================================================
// Plan gate for agent jobs
// =============================================================================
// Before the orchestrator queues a job, it asks this module "can this brand
// run this action right now?". The answer depends on the action:
//
//   • generate_image   → checkPostLimit (counts against posts/week)
//   • generate_video   → checkVideoLimit (+ feature gate)
//   • content:*        → checkPostLimit for actions that produce publishable assets
//   • everything else  → free (no counter)
//
// The gate is deliberately action-aware, not agent-aware: two content
// actions can have different costs (captions are free, videos aren't).
//
// This module does NOT increment counters. The counter is incremented when
// the actual publication happens (existing publishPost flow). A queued
// video job that gets cancelled doesn't burn the video quota.

import { checkPostLimit, checkVideoLimit, checkFeature } from '@/lib/plan-limits';
import type { PlanLimitResult } from '@/lib/plan-limits';
import type { AgentType } from './types';

// Actions that consume posts-per-week quota when scheduled (produce a post).
const POST_QUOTA_ACTIONS: ReadonlySet<string> = new Set([
  'content:generate_image',
  'content:apply_edit',
]);

// Actions that consume videos-per-week quota AND require the video feature.
const VIDEO_QUOTA_ACTIONS: ReadonlySet<string> = new Set([
  'content:generate_video',
]);

// Actions that require a specific plan feature flag (no per-week counter).
// The value must match a key in PLAN_LIMITS accepted by checkFeature.
const FEATURE_GATED_ACTIONS: Record<string, 'competitorAgent' | 'trendsAgent' | 'autoComments' | 'autoPublish'> = {
  'analytics:analyze_competitor': 'competitorAgent',
  'analytics:detect_trends':      'trendsAgent',
  'content:adapt_trend':          'trendsAgent',
  // strategy:plan_week is the autopilot feature — it fans out sub-jobs
  // automatically without user intervention. Gated behind autoPublish
  // (the existing literal closest to "autopilot" that checkFeature accepts).
  'strategy:plan_week':           'autoPublish',
};

// Actions that are free for every plan (text-only, cheap LLM calls).
const FREE_ACTIONS: ReadonlySet<string> = new Set([
  'content:generate_caption',
  'content:generate_ideas',
  'content:plan_edit',
  'content:seasonal_content',
  'content:analyze_inspiration',
  'scheduling:plan_calendar',
  'support:handle_interactions',
  'analytics:analyze_performance',
  'moderation:check_brand_safety',
  'growth:retention_email',
  // Strategy: taxonomy building and idea generation are one Opus call each,
  // cheap enough to be free across plans. Only plan_week (fan-out) is gated.
  'strategy:build_taxonomy',
  'strategy:generate_ideas',
]);

function keyOf(agent_type: AgentType, action: string): string {
  return `${agent_type}:${action}`;
}

/**
 * Ask the plan whether this brand can run this action now.
 * Returns { allowed: true } when free/within quota, otherwise { allowed: false, reason, upgradeUrl }.
 */
export async function checkActionAllowed(
  brand_id: string,
  agent_type: AgentType,
  action: string,
): Promise<PlanLimitResult> {
  const key = keyOf(agent_type, action);

  if (FREE_ACTIONS.has(key)) return { allowed: true };

  if (POST_QUOTA_ACTIONS.has(key)) {
    return checkPostLimit(brand_id);
  }

  if (VIDEO_QUOTA_ACTIONS.has(key)) {
    // checkVideoLimit already handles the feature gate via limit === 0.
    return checkVideoLimit(brand_id);
  }

  const feature = FEATURE_GATED_ACTIONS[key];
  if (feature) {
    return checkFeature(brand_id, feature);
  }

  // Unknown actions are allowed by default (new handlers should be added
  // to one of the sets above explicitly). We log so it's visible in prod.
  console.warn(`[plan-gate] ungated action: ${key} — allowing by default`);
  return { allowed: true };
}
