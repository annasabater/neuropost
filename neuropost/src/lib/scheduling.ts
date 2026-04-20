// =============================================================================
// Brand-aware publish scheduling helpers
// =============================================================================
//
// Pure functions (no I/O) so they can be imported from both server routes and
// client UI. Use them to:
//
//   1. Validate that a date chosen by the user does not break the brand's
//      publishing rules (noPublishDays / preferredDays).
//   2. Suggest the next valid publishing slot respecting noPublishDays,
//      preferredDays and the preferredHourStart/End window.

import { normalizePreferences } from '@/lib/plan-features';
import type { BrandRules, BrandPreferences, SubscriptionPlan } from '@/types';

export interface SchedulingRules {
  noPublishDays:  number[];              // 0..6, Sunday=0
  preferredDays:  number[];              // 0..6, empty => any day
  hourStart:      number;                // 0..23
  hourEnd:        number;                // 0..23, inclusive
}

/** Build the SchedulingRules object from a brand row. */
export function schedulingRulesFrom(
  rules:       BrandRules | null | undefined,
  preferences: BrandPreferences | undefined,
  plan:        SubscriptionPlan,
): SchedulingRules {
  const prefs = normalizePreferences(plan, preferences ?? rules?.preferences);
  return {
    noPublishDays: rules?.noPublishDays ?? [],
    preferredDays: prefs.preferredDays,
    hourStart:     prefs.preferredHourStart,
    hourEnd:       prefs.preferredHourEnd,
  };
}

/**
 * True if the given date is allowed to publish on.
 * - The weekday must NOT be in `noPublishDays`.
 * - If `preferredDays` is non-empty, the weekday must be one of them.
 */
export function isDayAllowed(date: Date, rules: SchedulingRules): boolean {
  const weekday = date.getDay();
  if (rules.noPublishDays.includes(weekday)) return false;
  if (rules.preferredDays.length > 0 && !rules.preferredDays.includes(weekday)) return false;
  return true;
}

/** True if the given date falls within the preferred hour window. */
export function isHourAllowed(date: Date, rules: SchedulingRules): boolean {
  const hour = date.getHours();
  return hour >= rules.hourStart && hour <= rules.hourEnd;
}

/** Combined check: both day and hour respect the rules. */
export function isSlotAllowed(date: Date, rules: SchedulingRules): boolean {
  return isDayAllowed(date, rules) && isHourAllowed(date, rules);
}

/**
 * Given a starting point (usually "now"), return the next date/time that
 * satisfies all scheduling rules. Searches at most 14 days forward and
 * advances hour by hour inside each allowed day.
 */
export function nextAllowedSlot(
  from:  Date,
  rules: SchedulingRules,
  maxDaysForward = 14,
): Date | null {
  const candidate = new Date(from);
  // Start at the top of the next hour to avoid returning a time already passed.
  candidate.setMinutes(0, 0, 0);
  candidate.setHours(candidate.getHours() + 1);

  for (let i = 0; i < maxDaysForward * 24; i++) {
    if (isSlotAllowed(candidate, rules)) return new Date(candidate);
    candidate.setHours(candidate.getHours() + 1);
  }
  return null;
}

/** Human-readable weekday label in Spanish. */
export function weekdayLabel(weekday: number): string {
  return ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][weekday] ?? 'Día';
}
