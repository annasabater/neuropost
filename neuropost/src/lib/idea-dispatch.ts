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
 *   1. weekly plan event  →  messages flag
 *   2. reel / video       →  videos flag
 *   3. visual asset       →  images flag
 *   4. text-only fallback →  messages flag
 *
 * Pure function — no I/O, no DB, no async. The caller is responsible
 * for resolving `effective` via resolveHumanReviewConfig() beforehand.
 */
export function routeIdea(
  idea:      RoutableIdea,
  effective: HumanReviewConfig,
  ctx:       RouteContext,
): RouteDecision {
  if (ctx.is_weekly_plan_event) {
    return decide('messages', effective, 'weekly plan event');
  }

  if (idea.format === 'reel') {
    return decide('videos', effective, 'reel / video asset');
  }

  const hasVisualAsset =
    idea.format === 'image' ||
    idea.format === 'carousel' ||
    idea.rendered_image_url  !== null ||
    idea.suggested_asset_url !== null;

  if (hasVisualAsset) {
    return decide('images', effective, 'visual asset');
  }

  return decide('messages', effective, 'text-only fallback');
}
