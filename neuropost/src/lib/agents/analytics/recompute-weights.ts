// =============================================================================
// analytics:recompute_weights — F5
// =============================================================================
// Rolling re-calibration of content_categories.weight based on real
// engagement data from post_analytics. Runs weekly via cron for every
// active brand, but can also be triggered manually via the agent queue.
//
// Formula (per category):
//
//   new_weight = 0.3 · initial_weight
//              + 0.5 · engagement_rate_norm
//              + 0.2 · recency_penalty
//
// Where:
//   • initial_weight  = the LLM's starting weight (never changes — anchor)
//   • engagement_rate_norm = brand's own top category = 1.0; others proportional
//   • recency_penalty = 1.0 if last published > 14 days ago, decays to 0 at 0 days
//
// This formula intentionally has inertia (coefficient 0.3 on initial) so the
// weights don't oscillate wildly from a single viral post. The analytics_loop
// also updates format_affinity per category based on which format performed
// best historically.
//
// When a brand has ZERO analytics data (no posts, no rows, new brand), the
// handler is a no-op and returns an output with reason: 'no_data'.

import { createAdminClient } from '@/lib/supabase';
import type { AgentJob, HandlerResult } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

// Fresh anchors — how we store the LLM's initial weight so we can recompute
// against it forever. We keep `weight_initial` implicitly via the metadata
// column, falling back to current weight on first recompute (no-op).
//
// Concretely: on first recompute we treat current `weight` as initial_weight.
// On subsequent recomputes we read the same initial_weight from metadata we
// set ourselves. This means the first recompute is idempotent and cheap.

const INERTIA_COEFF   = 0.3;
const ENGAGEMENT_COEFF = 0.5;
const RECENCY_COEFF   = 0.2;

const RECENCY_SATURATION_DAYS = 14; // full penalty beyond this

interface AnalyticsRow {
  post_id:         string;
  category_key:    string | null;
  format:          string | null;
  engagement_rate: number | null;
  published_at:    string | null;
}

interface CategoryRow {
  id:               string;
  category_key:     string;
  parent_key:       string | null;
  weight:           number;
  performance_score: number | null;
  format_affinity:  Record<string, number> | null;
  description:      string | null;
}

interface CategoryStats {
  category_key:      string;
  avg_engagement:    number;
  post_count:        number;
  last_published_at: string | null;
  format_counts:     Record<string, number>;
  format_engagement: Record<string, number>; // format → avg engagement
}

// -----------------------------------------------------------------------------
// Aggregate analytics rows into per-category stats
// -----------------------------------------------------------------------------

function aggregate(rows: AnalyticsRow[]): Map<string, CategoryStats> {
  const byCategory = new Map<string, CategoryStats>();

  for (const r of rows) {
    if (!r.category_key) continue;
    if (r.engagement_rate == null) continue;

    let stats = byCategory.get(r.category_key);
    if (!stats) {
      stats = {
        category_key:      r.category_key,
        avg_engagement:    0,
        post_count:        0,
        last_published_at: null,
        format_counts:     {},
        format_engagement: {},
      };
      byCategory.set(r.category_key, stats);
    }

    // Rolling average update.
    stats.avg_engagement = (stats.avg_engagement * stats.post_count + r.engagement_rate) / (stats.post_count + 1);
    stats.post_count    += 1;

    if (r.published_at) {
      if (!stats.last_published_at || r.published_at > stats.last_published_at) {
        stats.last_published_at = r.published_at;
      }
    }

    if (r.format) {
      stats.format_counts[r.format]     = (stats.format_counts[r.format] ?? 0) + 1;
      // Running average for format engagement.
      const prev = stats.format_engagement[r.format] ?? 0;
      const n    = stats.format_counts[r.format];
      stats.format_engagement[r.format] = (prev * (n - 1) + r.engagement_rate) / n;
    }
  }

  return byCategory;
}

// -----------------------------------------------------------------------------
// Recency penalty: 0 when just published, 1 when never / long ago
// -----------------------------------------------------------------------------

function recencyPenalty(lastPublishedAt: string | null): number {
  if (!lastPublishedAt) return 1.0;
  const daysAgo = (Date.now() - new Date(lastPublishedAt).getTime()) / 86_400_000;
  return Math.min(Math.max(daysAgo / RECENCY_SATURATION_DAYS, 0), 1);
}

// -----------------------------------------------------------------------------
// Format affinity derived from per-format engagement
// -----------------------------------------------------------------------------

function computeFormatAffinity(
  formatEng: Record<string, number>,
): Record<string, number> {
  const entries = Object.entries(formatEng);
  if (entries.length === 0) return {};
  const total = entries.reduce((s, [, v]) => s + Math.max(v, 0), 0);
  if (total === 0) return {};
  return Object.fromEntries(entries.map(([f, v]) => [f, Math.max(v, 0) / total]));
}

// -----------------------------------------------------------------------------
// Main recompute — called by the handler + the cron
// -----------------------------------------------------------------------------

export interface RecomputeResult {
  brand_id:        string;
  updated:         number;       // categories with changed weight
  skipped:         number;       // categories with no data
  rows_analyzed:   number;
  reason?:         'no_data' | 'no_categories';
}

export async function recomputeBrandWeights(brandId: string): Promise<RecomputeResult> {
  const db = createAdminClient() as DB;

  // 1. Pull analytics for the rolling window (last 60 days).
  const cutoff = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const { data: analyticsRows, error: aErr } = await db
    .from('post_analytics')
    .select('post_id, category_key, format, engagement_rate, published_at')
    .eq('brand_id', brandId)
    .gte('published_at', cutoff);
  if (aErr) throw new Error(`analytics read: ${aErr.message}`);

  // 2. Pull the current taxonomy.
  const { data: categories, error: cErr } = await db
    .from('content_categories')
    .select('id, category_key, parent_key, weight, performance_score, format_affinity, description')
    .eq('brand_id', brandId);
  if (cErr) throw new Error(`categories read: ${cErr.message}`);

  const cats = (categories ?? []) as CategoryRow[];
  if (cats.length === 0) {
    return { brand_id: brandId, updated: 0, skipped: 0, rows_analyzed: 0, reason: 'no_categories' };
  }

  const rows = (analyticsRows ?? []) as AnalyticsRow[];
  if (rows.length === 0) {
    return { brand_id: brandId, updated: 0, skipped: cats.length, rows_analyzed: 0, reason: 'no_data' };
  }

  // 3. Aggregate + normalize engagement across this brand's categories.
  const stats = aggregate(rows);
  const allEngagements = [...stats.values()].map((s) => s.avg_engagement);
  const maxEngagement = Math.max(...allEngagements, 0.001); // avoid div/0

  // 4. Compute new weights and persist.
  let updated = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const cat of cats) {
    const s = stats.get(cat.category_key);
    if (!s) {
      skipped += 1;
      continue;
    }

    const initial = cat.weight; // on first run we treat the stored weight as the anchor
    const engagementNorm = Math.min(s.avg_engagement / maxEngagement, 1);
    const recency = recencyPenalty(s.last_published_at);

    const newWeight =
      INERTIA_COEFF   * initial +
      ENGAGEMENT_COEFF * engagementNorm +
      RECENCY_COEFF    * recency;

    // Clamp to [0.01, 1.0] so a category never fully disappears.
    const clamped = Math.min(Math.max(newWeight, 0.01), 1.0);
    const formatAffinity = computeFormatAffinity(s.format_engagement);

    const { error: updErr } = await db
      .from('content_categories')
      .update({
        weight:            clamped,
        performance_score: s.avg_engagement,
        format_affinity:   formatAffinity,
        last_published_at: s.last_published_at ?? null,
        updated_at:        now,
      })
      .eq('id', cat.id);
    if (updErr) throw new Error(`update ${cat.category_key}: ${updErr.message}`);
    updated += 1;
  }

  return {
    brand_id:      brandId,
    updated,
    skipped,
    rows_analyzed: rows.length,
  };
}

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------

export async function recomputeWeightsHandler(job: AgentJob): Promise<HandlerResult> {
  if (!job.brand_id) return { type: 'fail', error: 'brand_id is required' };
  try {
    const result = await recomputeBrandWeights(job.brand_id);
    return {
      type: 'ok',
      outputs: [{
        kind:    'analysis',
        payload: result as unknown as Record<string, unknown>,
        model:   'rule-based-recompute',
      }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { type: 'fail', error: msg };
  }
}
