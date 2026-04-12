// =============================================================================
// analytics:sync_post_metrics
// =============================================================================
// Reads Instagram Insights for every published post of a brand and upserts
// the metrics into post_analytics. Uses the existing getIGPostInsights()
// from src/lib/meta.ts — no new Meta API surface needed.
//
// Flow:
//   1. Load brand (needs ig_access_token + ig_account_id)
//   2. Pull all published posts with an ig_post_id in the last N days
//   3. For each post → getIGPostInsights()
//   4. Upsert into post_analytics
//
// Inputs (job.input):
//   { days?: number }   // window (default 60, max 90)
//
// This handler is designed to be called:
//   • By the weekly recompute-weights cron (as a dependency before recompute)
//   • Directly via POST /api/agent-jobs when a user wants fresh data
//   • By the existing /api/cron/sync-comments (if wired to also enqueue this)
//
// Rate limits: Instagram Graph API allows ~200 calls/hour per user token.
// A brand with 20 published posts/60 days = 20 API calls = well within.
// For brands with 100+ posts we batch with a safety cap.

import { getIGPostInsights, type IGPostInsights } from '@/lib/meta';
import { createAdminClient } from '@/lib/supabase';
import type { AgentJob, HandlerResult } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

const MAX_POSTS_PER_SYNC = 100; // safety cap to stay under rate limits

interface PostRow {
  id:                     string;
  ig_post_id:             string;
  published_at:           string | null;
  format:                 string | null;
  strategy_category_key:  string | null;
}

function computeEngagementRate(m: IGPostInsights): number | null {
  if (!m.reach || m.reach === 0) return null;
  return (m.likes + m.comments + m.saved + m.shares) / m.reach;
}

function dayOfWeek(dateStr: string): number {
  // Mon=0, Sun=6
  const d = new Date(dateStr).getUTCDay();
  return d === 0 ? 6 : d - 1;
}

export interface SyncResult {
  brand_id:       string;
  posts_checked:  number;
  posts_updated:  number;
  posts_skipped:  number; // ig_post_id exists but insights call failed
  reason?:        'no_token' | 'no_posts';
}

export async function syncPostMetricsHandler(job: AgentJob): Promise<HandlerResult> {
  if (!job.brand_id) return { type: 'fail', error: 'brand_id is required' };

  const days = Math.min(Math.max(Number((job.input as { days?: number }).days ?? 60), 1), 90);

  try {
    const db = createAdminClient() as DB;

    // 1. Load brand for token.
    const { data: brand } = await db
      .from('brands')
      .select('id, ig_access_token, ig_account_id')
      .eq('id', job.brand_id)
      .single();
    if (!brand) return { type: 'fail', error: `Brand not found: ${job.brand_id}` };
    if (!brand.ig_access_token || !brand.ig_account_id) {
      return {
        type: 'ok',
        outputs: [{
          kind:    'analysis',
          payload: { brand_id: job.brand_id, posts_checked: 0, posts_updated: 0, posts_skipped: 0, reason: 'no_token' } as unknown as Record<string, unknown>,
          model:   'sync-post-metrics',
        }],
      };
    }

    // 2. Pull published posts with an ig_post_id within the window.
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data: posts } = await db
      .from('posts')
      .select('id, ig_post_id, published_at, format, strategy_category_key')
      .eq('brand_id', job.brand_id)
      .eq('status', 'published')
      .not('ig_post_id', 'is', null)
      .gte('published_at', cutoff)
      .order('published_at', { ascending: false })
      .limit(MAX_POSTS_PER_SYNC);

    const rows = (posts ?? []) as PostRow[];
    if (rows.length === 0) {
      return {
        type: 'ok',
        outputs: [{
          kind:    'analysis',
          payload: { brand_id: job.brand_id, posts_checked: 0, posts_updated: 0, posts_skipped: 0, reason: 'no_posts' } as unknown as Record<string, unknown>,
          model:   'sync-post-metrics',
        }],
      };
    }

    // 3. Fetch insights for each post.
    let updated = 0;
    let skipped = 0;

    for (const post of rows) {
      try {
        const insights = await getIGPostInsights(post.ig_post_id, brand.ig_access_token);
        const engRate = computeEngagementRate(insights);
        const publishedHour = post.published_at ? new Date(post.published_at).getUTCHours() : null;
        const publishedDay  = post.published_at ? dayOfWeek(post.published_at) : null;

        // Map the DB format to our taxonomy format names.
        const formatMap: Record<string, string> = {
          image:    'foto',
          carousel: 'carrusel',
          reel:     'reel',
          video:    'video',
          story:    'story',
        };
        const format = formatMap[post.format ?? 'image'] ?? post.format ?? 'foto';

        await db
          .from('post_analytics')
          .upsert({
            post_id:         post.id,
            brand_id:        job.brand_id,
            impressions:     insights.impressions,
            reach:           insights.reach,
            likes:           insights.likes,
            comments:        insights.comments,
            saves:           insights.saved,
            shares:          insights.shares,
            engagement_rate: engRate,
            best_hour:       publishedHour,
            best_day:        publishedDay,
            category_key:    post.strategy_category_key,
            format,
            published_at:    post.published_at,
            fetched_at:      new Date().toISOString(),
          }, { onConflict: 'post_id' });

        updated += 1;
      } catch {
        // Individual post insight failure — don't abort the whole batch.
        skipped += 1;
      }
    }

    const result: SyncResult = {
      brand_id:      job.brand_id,
      posts_checked: rows.length,
      posts_updated: updated,
      posts_skipped: skipped,
    };

    return {
      type: 'ok',
      outputs: [{
        kind:    'analysis',
        payload: result as unknown as Record<string, unknown>,
        model:   'sync-post-metrics',
      }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Meta API rate limits or auth errors are transient — retry.
    const transient = /timeout|rate.?limit|overloaded|503|504|ECONN|OAuthException/i.test(msg);
    return transient ? { type: 'retry', error: msg } : { type: 'fail', error: msg };
  }
}
