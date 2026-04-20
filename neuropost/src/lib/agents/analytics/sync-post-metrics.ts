// =============================================================================
// analytics:sync_post_metrics — multi-platform version
// =============================================================================
// Walks every published post_publications row for a brand within the time
// window, calls the platform provider's fetchPostInsights, and upserts the
// result into post_analytics using the composite (post_id, platform) PK.
//
// Replaces the earlier IG-only version that read brands.ig_access_token
// directly. Now we load platform_connections rows via the provider
// repository and go platform-by-platform — any provider that throws
// ProviderError('not_implemented') (e.g. TikTok until research-API
// approval lands) is skipped gracefully.
//
// Inputs (job.input):
//   { days?: number }   // window in days (default 60, max 90)
//
// Rate limits: each platform's provider is the source of truth for its
// own rate limits. We cap total publications per sync at 100 to stay
// safely inside Meta's 200-calls/hour/token limit.
// =============================================================================

import { createAdminClient } from '@/lib/supabase';
import {
  getProvider,
  getConnection,
  ProviderError,
  type Platform,
  type PlatformInsights,
} from '@/lib/platforms';
import type { AgentJob, HandlerResult } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

const MAX_POSTS_PER_SYNC = 100;

interface PublicationRow {
  id:               string;
  post_id:          string;
  platform:         Platform;
  platform_post_id: string | null;
  published_at:     string | null;
  post: {
    format: string | null;
    strategy_category_key: string | null;
  } | null;
}

// Platform → metrics mapping into post_analytics columns. Each provider's
// insights shape is different, so we normalise here into the column set
// the table actually has.
function toRow(
  insights:  PlatformInsights,
  publicationRow: PublicationRow,
  brandId:   string,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    post_id:       publicationRow.post_id,
    brand_id:      brandId,
    platform:      insights.platform,
    fetched_at:    new Date().toISOString(),
    published_at:  publicationRow.published_at,
    category_key:  publicationRow.post?.strategy_category_key ?? null,
    format:        mapFormat(publicationRow.post?.format),
    best_day:      publicationRow.published_at ? dayOfWeek(publicationRow.published_at) : null,
    best_hour:     publicationRow.published_at ? new Date(publicationRow.published_at).getUTCHours() : null,
  };

  if (insights.platform === 'instagram') {
    return {
      ...base,
      reach:              insights.reach,
      impressions:        insights.impressions,
      likes:              insights.likes,
      comments:           insights.comments,
      saves:              insights.saves,
      shares:             insights.shares,
      video_views:        insights.videoViews ?? null,
      avg_watch_time_sec: insights.avgWatchTimeSec ?? null,
      engagement_rate:    engagementRate(insights.likes, insights.comments, insights.saves, insights.shares, insights.reach),
    };
  }
  if (insights.platform === 'facebook') {
    return {
      ...base,
      reach:              insights.reach,
      impressions:        insights.impressions,
      // Facebook lumps reactions (likes/love/haha/…) into one field —
      // persist them under `likes` so cross-platform queries still work.
      likes:              insights.reactions,
      comments:           insights.comments,
      saves:              0,
      shares:             insights.shares,
      video_views:        insights.videoViews ?? null,
      avg_watch_time_sec: insights.avgWatchTimeSec ?? null,
      engagement_rate:    engagementRate(insights.reactions, insights.comments, 0, insights.shares, insights.reach),
    };
  }
  // TikTok
  return {
    ...base,
    reach:              insights.videoViews, // closest proxy; TT API doesn't give reach
    impressions:        insights.videoViews,
    likes:              insights.likes,
    comments:           insights.comments,
    saves:              0,
    shares:             insights.shares,
    video_views:        insights.videoViews,
    avg_watch_time_sec: insights.avgWatchTimeSec ?? null,
    completion_rate:    insights.completionRate ?? null,
    engagement_rate:    engagementRate(insights.likes, insights.comments, 0, insights.shares, insights.videoViews),
  };
}

function engagementRate(
  a: number, b: number, c: number, d: number, denom: number,
): number | null {
  if (!denom || denom === 0) return null;
  return Number(((a + b + c + d) / denom).toFixed(4));
}

function dayOfWeek(dateStr: string): number {
  // Mon = 0 … Sun = 6
  const d = new Date(dateStr).getUTCDay();
  return d === 0 ? 6 : d - 1;
}

function mapFormat(raw: string | null | undefined): string {
  const m: Record<string, string> = {
    image: 'foto', foto: 'foto', photo: 'foto',
    carousel: 'carrusel', carrusel: 'carrusel',
    reel: 'reel', reels: 'reel',
    video: 'video', videos: 'video',
    story: 'story', stories: 'story',
  };
  return m[(raw ?? 'foto').toLowerCase()] ?? 'foto';
}

export interface SyncResult {
  brand_id:       string;
  window_days:    number;
  per_platform:   Record<Platform, {
    checked:    number;
    updated:    number;
    skipped:    number;
    not_connected?: boolean;
  }>;
}

export async function syncPostMetricsHandler(job: AgentJob): Promise<HandlerResult> {
  if (!job.brand_id) return { type: 'fail', error: 'brand_id is required' };

  const days   = Math.min(Math.max(Number((job.input as { days?: number }).days ?? 60), 1), 90);
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const db     = createAdminClient() as DB;

  try {
    // Published publications in the window, joined with the posts row for
    // format + category. Sort newest-first so rate-limit-capped brands get
    // fresh data before old data.
    const { data: pubs } = await db
      .from('post_publications')
      .select(`
        id, post_id, platform, platform_post_id, published_at,
        post:posts!inner(
          format, strategy_category_key, brand_id
        )
      `)
      .eq('status', 'published')
      .not('platform_post_id', 'is', null)
      .gte('published_at', cutoff)
      .eq('posts.brand_id', job.brand_id)
      .order('published_at', { ascending: false })
      .limit(MAX_POSTS_PER_SYNC);

    const rows = (pubs ?? []) as PublicationRow[];

    const perPlatform: SyncResult['per_platform'] = {
      instagram: { checked: 0, updated: 0, skipped: 0 },
      facebook:  { checked: 0, updated: 0, skipped: 0 },
      tiktok:    { checked: 0, updated: 0, skipped: 0 },
    };

    // Per-platform connection caching — avoid N queries for the same token.
    const connCache = new Map<Platform, Awaited<ReturnType<typeof getConnection>>>();

    for (const pub of rows) {
      if (!pub.platform_post_id) continue;

      let conn = connCache.get(pub.platform);
      if (conn === undefined) {
        conn = await getConnection(job.brand_id, pub.platform);
        connCache.set(pub.platform, conn);
      }

      if (!conn) {
        perPlatform[pub.platform].not_connected = true;
        perPlatform[pub.platform].skipped += 1;
        continue;
      }

      perPlatform[pub.platform].checked += 1;

      try {
        const insights = await getProvider(pub.platform).fetchPostInsights(
          pub.platform_post_id,
          conn,
        );

        await db
          .from('post_analytics')
          .upsert(toRow(insights, pub, job.brand_id), { onConflict: 'post_id,platform' });

        perPlatform[pub.platform].updated += 1;
      } catch (err) {
        // not_implemented (TikTok today, etc.) — silent skip, not an error
        if (err instanceof ProviderError && err.code === 'not_implemented') {
          perPlatform[pub.platform].skipped += 1;
          continue;
        }
        // Transient (rate limit / network) — skip this post but keep going.
        perPlatform[pub.platform].skipped += 1;
      }
    }

    const result: SyncResult = {
      brand_id:    job.brand_id,
      window_days: days,
      per_platform: perPlatform,
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
    const msg       = err instanceof Error ? err.message : String(err);
    const transient = /timeout|rate.?limit|overloaded|503|504|ECONN|OAuthException/i.test(msg);
    return transient ? { type: 'retry', error: msg } : { type: 'fail', error: msg };
  }
}
