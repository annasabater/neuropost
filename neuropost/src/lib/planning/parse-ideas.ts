// =============================================================================
// Planning — parse-ideas
// =============================================================================
// Shared helper used by:
//   - src/lib/agents/strategy/plan-week.ts  (live pipeline)
//   - scripts/backfill_weekly_plans.ts       (retroactive backfill)
//
// Converts raw strategy payload (as stored in agent_outputs.payload) into
// structured ParsedIdea rows ready for insertion into content_ideas.

import type { ContentIdeaFormat } from '@/types';

export type { ContentIdeaFormat };

export interface ParsedIdea {
  position:             number;
  day_of_week:          number | null;
  format:               ContentIdeaFormat;
  angle:                string;
  hook:                 string | null;
  copy_draft:           string | null;
  hashtags:             string[] | null;
  suggested_asset_url:  string | null;
  suggested_asset_id:   string | null;
  category_id:          string | null;
}

/** Map LLM format strings to the DB enum. */
function mapFormat(raw: unknown): ContentIdeaFormat {
  switch (String(raw ?? '').toLowerCase()) {
    case 'carrusel':
    case 'carousel': return 'carousel';
    case 'reel':     return 'reel';
    case 'story':    return 'story';
    case 'video':    return 'reel';   // no video format in content_ideas; reel is closest
    default:         return 'image';  // 'foto' + fallback
  }
}

/**
 * Extracts structured ideas from an agent_output payload with kind='strategy'.
 * Returns [] if the payload is not a plan-week output (e.g. taxonomy outputs).
 *
 * A plan-week payload must have `ideas` as a non-empty array.
 */
export function parseIdeasFromStrategyPayload(payload: unknown): ParsedIdea[] {
  if (!payload || typeof payload !== 'object') return [];
  const p = payload as Record<string, unknown>;
  if (!Array.isArray(p['ideas']) || p['ideas'].length === 0) return [];

  const raw = p['ideas'] as Array<Record<string, unknown>>;

  return raw.map((idea, i) => {
    const rawCopy = typeof idea['copy_draft'] === 'string' ? idea['copy_draft'].trim() : '';
    const rawTags = Array.isArray(idea['hashtags'])
      ? (idea['hashtags'] as unknown[]).filter((h): h is string => typeof h === 'string')
      : [];
    return {
      position:             i,
      day_of_week:          null,
      format:               mapFormat(idea['format']),
      angle:                String(idea['title'] ?? idea['caption_angle'] ?? `Idea ${i + 1}`),
      hook:                 typeof idea['caption_angle'] === 'string' ? idea['caption_angle'] : null,
      // Defensive fallback: validateIdeas should have caught missing/malformed
      // copy_draft + hashtags, but we still accept null here so a single bad
      // idea doesn't bring down the whole plan if validation is ever relaxed.
      copy_draft:           rawCopy.length > 0 ? rawCopy : null,
      hashtags:             rawTags.length > 0 ? rawTags : null,
      suggested_asset_url:  null,
      suggested_asset_id:   null,
      category_id:          null,
    };
  });
}

/**
 * Returns the ISO date (YYYY-MM-DD) of the Monday of the week that contains
 * the given date. If no date is supplied, uses the current UTC time.
 */
export function extractWeekStart(fromDate?: string | Date): string {
  const d = fromDate ? new Date(fromDate) : new Date();
  const day = d.getUTCDay();                          // 0=Sun … 6=Sat
  const daysBack = day === 0 ? 6 : day - 1;           // distance to Monday
  d.setUTCDate(d.getUTCDate() - daysBack);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

/**
 * Returns true only for outputs that are real plan-week outputs
 * (contain a non-empty `ideas` array). Filters out build-taxonomy outputs
 * that share the same kind='strategy'.
 */
export function isPlanWeekPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return Array.isArray(p['ideas']) && (p['ideas'] as unknown[]).length > 0;
}
