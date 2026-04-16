// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/analytics/[platform]/[brandId]?from=ISO&to=ISO
//
//  Per-platform analytics. Returns the native metric shape for this platform
//  (we deliberately don't unify — spec answer "cada plataforma guarda sus
//  métricas nativas"). The UI renders whichever shape it got.
//
//  Response envelope:
//    {
//      platform:   'instagram' | 'facebook' | 'tiktok',
//      brandId:    uuid,
//      range:      { from, to },
//      totals:     { posts, reach, impressions, engagement, ... }
//      posts:      [ per-post analytics row, newest first, up to 50 ]
//      timeline:   [ { date: 'YYYY-MM-DD', reach, engagement } … 30 buckets ]
//      bestSlots:  [ { dayOfWeek, hour, avgReach, sampleSize } … top 5 ]
//    }
//
//  Owner OR worker can read. Anonymous = 401.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createAdminClient } from '@/lib/supabase';
import { parsePlatform, type Platform } from '@/lib/platforms';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

interface AnalyticsRow {
  post_id:            string;
  brand_id:           string;
  platform:           Platform;
  impressions:        number | null;
  reach:              number | null;
  likes:              number | null;
  comments:           number | null;
  saves:              number | null;
  shares:             number | null;
  video_views:        number | null;
  avg_watch_time_sec: number | null;
  completion_rate:    number | null;
  engagement_rate:    number | null;
  best_day:           number | null;
  best_hour:          number | null;
  format:             string | null;
  published_at:       string | null;
}

async function userCanReadBrand(db: DB, userId: string, brandId: string): Promise<boolean> {
  const { data: brand } = await db
    .from('brands')
    .select('id')
    .eq('id', brandId)
    .eq('user_id', userId)
    .maybeSingle();
  if (brand) return true;

  const { data: worker } = await db
    .from('workers')
    .select('id, is_active')
    .eq('id', userId)
    .eq('is_active', true)
    .maybeSingle();
  return !!worker;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ platform: string; brandId: string }> },
) {
  try {
    const { platform: rawPlatform, brandId } = await params;
    const platform = parsePlatform(rawPlatform);
    if (!platform) {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
    }

    const user = await requireServerUser();
    const db   = createAdminClient() as DB;

    if (!(await userCanReadBrand(db, user.id, brandId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Default window: last 30 days.
    const url  = new URL(request.url);
    const to   = url.searchParams.get('to')   ? new Date(url.searchParams.get('to')!)   : new Date();
    const from = url.searchParams.get('from') ? new Date(url.searchParams.get('from')!) : new Date(to.getTime() - 30 * 86_400_000);

    // ── 1. Per-post analytics rows in the window ──────────────────────────
    const { data: postsRaw } = await db
      .from('post_analytics')
      .select('*')
      .eq('brand_id', brandId)
      .eq('platform', platform)
      .gte('published_at', from.toISOString())
      .lte('published_at', to.toISOString())
      .order('published_at', { ascending: false })
      .limit(50);

    const posts = (postsRaw ?? []) as AnalyticsRow[];

    // ── 2. Totals ─────────────────────────────────────────────────────────
    const totals = posts.reduce((acc, p) => {
      acc.reach       += p.reach       ?? 0;
      acc.impressions += p.impressions ?? 0;
      acc.likes       += p.likes       ?? 0;
      acc.comments    += p.comments    ?? 0;
      acc.saves       += p.saves       ?? 0;
      acc.shares      += p.shares      ?? 0;
      acc.videoViews  += p.video_views ?? 0;
      return acc;
    }, { posts: posts.length, reach: 0, impressions: 0, likes: 0, comments: 0, saves: 0, shares: 0, videoViews: 0 });

    const engagementRateAvg = posts.length === 0 ? 0 :
      posts.reduce((a, p) => a + (p.engagement_rate ?? 0), 0) / posts.length;

    // ── 3. Daily timeline ─────────────────────────────────────────────────
    const bucketed = new Map<string, { reach: number; engagement: number; count: number }>();
    for (const p of posts) {
      if (!p.published_at) continue;
      const day = p.published_at.slice(0, 10);
      const prev = bucketed.get(day) ?? { reach: 0, engagement: 0, count: 0 };
      prev.reach      += p.reach ?? 0;
      prev.engagement += p.engagement_rate ?? 0;
      prev.count      += 1;
      bucketed.set(day, prev);
    }
    const timeline = Array.from(bucketed.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        reach:      v.reach,
        engagement: v.count > 0 ? Number((v.engagement / v.count).toFixed(4)) : 0,
      }));

    // ── 4. Best posting slots (aggregate over the entire window) ──────────
    const slotMap = new Map<string, { day: number; hour: number; totalReach: number; samples: number }>();
    for (const p of posts) {
      if (p.best_day == null || p.best_hour == null) continue;
      const key = `${p.best_day}-${p.best_hour}`;
      const prev = slotMap.get(key) ?? { day: p.best_day, hour: p.best_hour, totalReach: 0, samples: 0 };
      prev.totalReach += p.reach ?? 0;
      prev.samples    += 1;
      slotMap.set(key, prev);
    }
    const bestSlots = Array.from(slotMap.values())
      .map(s => ({
        dayOfWeek:  s.day,
        hour:       s.hour,
        avgReach:   s.samples > 0 ? Math.round(s.totalReach / s.samples) : 0,
        sampleSize: s.samples,
      }))
      .sort((a, b) => b.avgReach - a.avgReach)
      .slice(0, 5);

    return NextResponse.json({
      platform,
      brandId,
      range:     { from: from.toISOString(), to: to.toISOString() },
      totals:    { ...totals, engagementRateAvg: Number(engagementRateAvg.toFixed(4)) },
      posts,
      timeline,
      bestSlots,
    });
  } catch (err) {
    return apiError(err, 'GET /api/analytics/[platform]/[brandId]');
  }
}
