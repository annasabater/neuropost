// =============================================================================
// Client-safe plan feature helpers
// =============================================================================
//
// `lib/plan-limits.ts` talks to Supabase and can't be imported from client
// components. This file exposes the same data via pure functions so UI code
// can gate controls, show "upgrade" badges, and clamp user input to plan
// boundaries without touching the server.

import { PLAN_LIMITS, PLAN_META } from '@/types';
import type { SubscriptionPlan, BrandPreferences } from '@/types';

/** Plan that unlocks a given feature (lowest plan where it's enabled). */
const PLAN_ORDER: SubscriptionPlan[] = ['starter', 'pro', 'total', 'agency'];

/** Default preferences for a brand, clamped to the plan's ceiling. */
export function defaultPreferencesFor(plan: SubscriptionPlan): BrandPreferences {
  const limits = PLAN_LIMITS[plan];
  return {
    preferredDays:      [],                                    // no preference
    postsPerWeek:       Math.min(limits.postsPerWeek, 5),      // sensible default
    includeVideos:      limits.videosPerWeek > 0,
    videosPerWeek:      limits.videosPerWeek > 0 ? Math.min(limits.videosPerWeek, 2) : 0,
    likesCarousels:     true,
    carouselSize:       Math.min(limits.carouselMaxPhotos, 5),
    preferredHourStart: 14,                                    // 14:00
    preferredHourEnd:   21,                                    // 21:00
    hashtagsEnabled:    true,
    slogansEnabled:     true,
  };
}

/** Hydrate + clamp preferences coming from the database. */
export function normalizePreferences(
  plan:  SubscriptionPlan,
  input: Partial<BrandPreferences> | undefined | null,
): BrandPreferences {
  const base = defaultPreferencesFor(plan);
  if (!input) return base;
  const limits = PLAN_LIMITS[plan];
  const startHour = clamp(input.preferredHourStart ?? base.preferredHourStart, 0, 23);
  const endHour   = clamp(input.preferredHourEnd   ?? base.preferredHourEnd,   0, 23);
  return {
    preferredDays:      Array.isArray(input.preferredDays) ? input.preferredDays.filter(d => d >= 0 && d <= 6) : base.preferredDays,
    postsPerWeek:       clamp(input.postsPerWeek  ?? base.postsPerWeek,  0, limits.postsPerWeek),
    includeVideos:      (input.includeVideos  ?? base.includeVideos)  && limits.videosPerWeek > 0,
    videosPerWeek:      clamp(input.videosPerWeek ?? base.videosPerWeek, 0, limits.videosPerWeek),
    likesCarousels:     input.likesCarousels ?? base.likesCarousels,
    carouselSize:       clamp(input.carouselSize ?? base.carouselSize, 0, limits.carouselMaxPhotos),
    // If the range is inverted, swap so start is always ≤ end.
    preferredHourStart: Math.min(startHour, endHour),
    preferredHourEnd:   Math.max(startHour, endHour),
    hashtagsEnabled:    input.hashtagsEnabled ?? base.hashtagsEnabled,
    slogansEnabled:     input.slogansEnabled ?? base.slogansEnabled,
  };
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  if (!Number.isFinite(max)) return Math.max(min, n);
  return Math.min(Math.max(n, min), max);
}

/** Lowest plan that unlocks a given feature flag. */
export function minimumPlanFor(
  feature: 'autoPublish' | 'competitorAgent' | 'trendsAgent' | 'autoComments' | 'videos',
): SubscriptionPlan | null {
  for (const plan of PLAN_ORDER) {
    const limits = PLAN_LIMITS[plan];
    if (feature === 'videos') {
      if (limits.videosPerWeek > 0) return plan;
    } else if (limits[feature]) {
      return plan;
    }
  }
  return null;
}

/** Human-readable "upgrade to X" label. */
export function upgradeLabel(minPlan: SubscriptionPlan | null): string {
  if (!minPlan) return 'No disponible';
  return `Disponible en ${PLAN_META[minPlan].label}`;
}
