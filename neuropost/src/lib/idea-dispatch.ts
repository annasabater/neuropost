import type { HumanReviewConfig } from '@/types';
import type { HrcUiKey }          from '@/lib/human-review';

export type IdeaRoute = 'worker_review' | 'client_review';

export interface RoutableIdea {
  content_kind:        'post' | 'story';
  format:              'image' | 'reel' | 'carousel' | 'story';
  suggested_asset_url: string | null;
  rendered_image_url:  string | null;
}

export interface RouteContext {
  /** true = decision about a full weekly_plan event; false = individual
   *  idea emitted mid-week (e.g. regeneration). */
  is_weekly_plan_event: boolean;
  /** true = this idea is a regeneration (client asked for a variation);
   *  false = initial generation (e.g. weekly plan). */
  is_regeneration:      boolean;
}

export interface RouteDecision {
  route:            IdeaRoute;
  flag_checked:     HrcUiKey;
  effective_value:  boolean;
  reason:           string;
}

function decide(flag: HrcUiKey, effective: HumanReviewConfig, reason: string): RouteDecision {
  const value = effective[flag];
  return {
    route:           value ? 'worker_review' : 'client_review',
    flag_checked:    flag,
    effective_value: value,
    reason,
  };
}

/**
 * Decide whether a generated idea needs worker review first, or can be
 * sent to the client directly. Precedence:
 *
 *   1. weekly plan event  →  messages_create
 *   2. reel / video       →  videos_create  | videos_regen
 *   3. visual asset       →  images_create  | images_regen
 *   4. text-only fallback →  messages_create | messages_regen
 *
 * Which of each pair is consulted depends on ctx.is_regeneration:
 * an initial generation reads the _create flag; a regeneration reads
 * the _regen flag.
 *
 * Pure function — no I/O, no DB, no async. The caller is responsible
 * for resolving `effective` via resolveHumanReviewConfig() beforehand.
 */
export function routeIdea(
  idea:      RoutableIdea,
  effective: HumanReviewConfig,
  ctx:       RouteContext,
): RouteDecision {
  // 1. Weekly plan event — always initial generation, never a regen.
  if (ctx.is_weekly_plan_event) {
    return decide('messages_create', effective, 'weekly plan event');
  }

  const regen = ctx.is_regeneration;

  // 2. Reel / video asset.
  if (idea.format === 'reel') {
    const flag = regen ? 'videos_regen' : 'videos_create';
    return decide(flag, effective, `reel / video asset (${regen ? 'regen' : 'create'})`);
  }

  // 3. Visual asset.
  const hasVisualAsset =
    idea.format === 'image' ||
    idea.format === 'carousel' ||
    idea.rendered_image_url  !== null ||
    idea.suggested_asset_url !== null;

  if (hasVisualAsset) {
    const flag = regen ? 'images_regen' : 'images_create';
    return decide(flag, effective, `visual asset (${regen ? 'regen' : 'create'})`);
  }

  // 4. Text-only fallback.
  const flag = regen ? 'messages_regen' : 'messages_create';
  return decide(flag, effective, `text-only fallback (${regen ? 'regen' : 'create'})`);
}
