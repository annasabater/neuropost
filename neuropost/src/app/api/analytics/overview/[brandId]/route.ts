// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/analytics/overview/[brandId]?from=ISO&to=ISO
//
//  Comparative view across all 3 platforms for one brand. Returns a
//  normalised subset of metrics (reach, engagement rate, published count)
//  so a worker dashboard can draw a side-by-side chart without caring
//  about native metric names.
//
//  Pairs with GET /api/analytics/[platform]/[brandId] — that endpoint
//  returns the native per-platform shape, this one returns the
//  cross-platform comparable shape.
//
//  Owner OR worker can read. Anonymous = 401.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createAdminClient } from '@/lib/supabase';
import { ALL_PLATFORMS, type Platform } from '@/lib/platforms';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

interface Row {
  platform:        Platform;
  reach:           number | null;
  impressions:     number | null;
  likes:           number | null;
  comments:        number | null;
  shares:          number | null;
  saves:           number | null;
  video_views:     number | null;
  engagement_rate: number | null;
  published_at:    string | null;
}

async function userCanReadBrand(db: DB, userId: string, brandId: string): Promise<boolean> {
  const { data: brand } = await db
    .from('brands').select('id').eq('id', brandId).eq('user_id', userId).maybeSingle();
  if (brand) return true;
  const { data: worker } = await db
    .from('workers').select('id').eq('id', userId).eq('is_active', true).maybeSingle();
  return !!worker;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const user = await requireServerUser();
    const db   = createAdminClient() as DB;

    if (!(await userCanReadBrand(db, user.id, brandId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url  = new URL(request.url);
    const to   = url.searchParams.get('to')   ? new Date(url.searchParams.get('to')!)   : new Date();
    const from = url.searchParams.get('from') ? new Date(url.searchParams.get('from')!) : new Date(to.getTime() - 30 * 86_400_000);

    const { data: rowsRaw } = await db
      .from('post_analytics')
      .select('platform, reach, impressions, likes, comments, shares, saves, video_views, engagement_rate, published_at')
      .eq('brand_id', brandId)
      .gte('published_at', from.toISOString())
      .lte('published_at', to.toISOString());

    const rows = (rowsRaw ?? []) as Row[];

    // Group by platform — "empty" platforms still get a zeroed entry so
    // the UI can render a bar of 0 rather than hiding the column.
    const byPlatform: Record<Platform, {
      posts:               number;
      reach:               number;
      impressions:         number;
      totalLikes:          number;
      totalComments:       number;
      totalShares:         number;
      totalSaves:          number;
      totalVideoViews:     number;
      avgEngagementRate:   number;
    }> = {
      instagram: zero(), facebook: zero(), tiktok: zero(),
    };

    // Also bucket per-day per-platform for a 30-point timeline the UI can
    // use for a multi-line chart.
    const timelineMap = new Map<string, Record<Platform, number>>();

    for (const r of rows) {
      const p = byPlatform[r.platform];
      p.posts          += 1;
      p.reach          += r.reach       ?? 0;
      p.impressions    += r.impressions ?? 0;
      p.totalLikes     += r.likes       ?? 0;
      p.totalComments  += r.comments    ?? 0;
      p.totalShares    += r.shares      ?? 0;
      p.totalSaves     += r.saves       ?? 0;
      p.totalVideoViews+= r.video_views ?? 0;
      p.avgEngagementRate += r.engagement_rate ?? 0;

      if (r.published_at) {
        const day = r.published_at.slice(0, 10);
        const prev = timelineMap.get(day) ?? { instagram: 0, facebook: 0, tiktok: 0 };
        prev[r.platform] += r.reach ?? 0;
        timelineMap.set(day, prev);
      }
    }

    // Finalise averages.
    for (const platform of ALL_PLATFORMS) {
      const p = byPlatform[platform];
      p.avgEngagementRate = p.posts > 0 ? Number((p.avgEngagementRate / p.posts).toFixed(4)) : 0;
    }

    const timeline = Array.from(timelineMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, byP]) => ({ date, ...byP }));

    // Winner of the window on each headline metric, so the UI can surface
    // "Instagram ganó por alcance, TikTok por engagement rate" quickly.
    const winners = {
      byReach:            winnerOf(byPlatform, p => p.reach),
      byEngagementRate:   winnerOf(byPlatform, p => p.avgEngagementRate),
      byPostsPublished:   winnerOf(byPlatform, p => p.posts),
    };

    return NextResponse.json({
      brandId,
      range:      { from: from.toISOString(), to: to.toISOString() },
      byPlatform,
      timeline,
      winners,
    });
  } catch (err) {
    return apiError(err, 'GET /api/analytics/overview/[brandId]');
  }
}

function zero() {
  return {
    posts: 0, reach: 0, impressions: 0,
    totalLikes: 0, totalComments: 0, totalShares: 0, totalSaves: 0,
    totalVideoViews: 0, avgEngagementRate: 0,
  };
}

function winnerOf(
  byPlatform: Record<Platform, { reach: number; avgEngagementRate: number; posts: number }>,
  pick:       (p: { reach: number; avgEngagementRate: number; posts: number }) => number,
): { platform: Platform; value: number } | null {
  let best: { platform: Platform; value: number } | null = null;
  for (const platform of ALL_PLATFORMS) {
    const value = pick(byPlatform[platform]);
    if (!best || value > best.value) best = { platform, value };
  }
  return best && best.value > 0 ? best : null;
}
