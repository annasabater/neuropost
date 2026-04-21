// GET /api/historial
// Returns published posts joined with post_analytics metrics.
// Also returns KPI aggregates and top performers, so the feed page
// can render the historial view without extra round-trips.

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

interface AnalyticsRow {
  post_id:         string;
  reach:           number | null;
  impressions:     number | null;
  likes:           number | null;
  comments:        number | null;
  saves:           number | null;
  shares:          number | null;
  engagement_rate: number | null;
}

export async function GET(request: Request) {
  try {
    const user = await requireServerUser();
    const db: DB = createAdminClient();
    const { searchParams } = new URL(request.url);
    const status   = searchParams.get('status');
    const platform = searchParams.get('platform');
    const format   = searchParams.get('format');
    const range    = searchParams.get('range') ?? '3m';

    const { data: brand } = await db
      .from('brands')
      .select('id, plan, subscribed_platforms')
      .eq('user_id', user.id)
      .single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    let query = db.from('posts')
      .select('id, image_url, edited_image_url, caption, hashtags, status, platform, format, is_story, published_at, created_at, ig_post_id, fb_post_id')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false });

    if (status && status !== 'all')     query = query.eq('status', status);
    if (platform && platform !== 'all') query = query.contains('platform', [platform]);
    if (format && format !== 'all')     query = query.eq('format', format);

    if (range !== 'all') {
      const months = range === '1m' ? 1 : 3;
      const since = new Date();
      since.setMonth(since.getMonth() - months);
      query = query.gte('created_at', since.toISOString());
    }

    const { data: posts, error } = await query;
    if (error) throw error;
    const all = (posts ?? []) as Array<Record<string, unknown>>;

    // Join analytics (one row per published post)
    const publishedIds = all
      .filter(p => p.status === 'published' && typeof p.id === 'string')
      .map(p => p.id as string);

    const analyticsMap = new Map<string, AnalyticsRow>();
    if (publishedIds.length > 0) {
      const { data: analytics } = await db
        .from('post_analytics')
        .select('post_id, reach, impressions, likes, comments, saves, shares, engagement_rate')
        .eq('brand_id', brand.id)
        .in('post_id', publishedIds);
      for (const row of (analytics ?? []) as AnalyticsRow[]) {
        analyticsMap.set(row.post_id, row);
      }
    }

    // Attach metrics inline + compute aggregates
    let totalReach = 0;
    let totalLikes = 0;
    let engRateSum = 0;
    let engRateN   = 0;
    const enriched = all.map(p => {
      const m = analyticsMap.get(p.id as string) ?? null;
      if (m) {
        totalReach += m.reach ?? 0;
        totalLikes += m.likes ?? 0;
        if (m.engagement_rate != null) {
          engRateSum += m.engagement_rate;
          engRateN   += 1;
        }
      }
      return { ...p, metrics: m };
    });

    // Platform breakdown (only published)
    const platformBreakdown: Record<string, { count: number; reach: number; likes: number }> = {
      instagram: { count: 0, reach: 0, likes: 0 },
      facebook:  { count: 0, reach: 0, likes: 0 },
      tiktok:    { count: 0, reach: 0, likes: 0 },
    };
    for (const p of enriched) {
      if (p.status !== 'published') continue;
      const plats = Array.isArray(p.platform) ? p.platform : (p.platform ? [p.platform] : []);
      const m = (p as { metrics: AnalyticsRow | null }).metrics;
      for (const plat of plats as string[]) {
        if (!platformBreakdown[plat]) continue;
        platformBreakdown[plat].count += 1;
        platformBreakdown[plat].reach += m?.reach ?? 0;
        platformBreakdown[plat].likes += m?.likes ?? 0;
      }
    }

    // Top 3 performers by engagement_rate (fallback reach)
    const topPerformers = [...enriched]
      .filter(p => (p as { metrics: AnalyticsRow | null }).metrics)
      .sort((a, b) => {
        const ma = (a as { metrics: AnalyticsRow }).metrics;
        const mb = (b as { metrics: AnalyticsRow }).metrics;
        const ea = ma.engagement_rate ?? 0;
        const eb = mb.engagement_rate ?? 0;
        if (eb !== ea) return eb - ea;
        return (mb.reach ?? 0) - (ma.reach ?? 0);
      })
      .slice(0, 3);

    const stats = {
      total: all.length,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      published: all.filter((p: any) => p.status === 'published').length,
      approvalRate: all.length > 0
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? Math.round((all.filter((p: any) => ['approved', 'published'].includes(p.status)).length / all.length) * 100)
        : 0,
      totalReach,
      totalLikes,
      avgEngagementRate: engRateN > 0 ? Math.round((engRateSum / engRateN) * 100) / 100 : 0,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subscribedPlatforms: string[] = (brand as any).subscribed_platforms ?? ['instagram'];

    return NextResponse.json({
      posts: enriched,
      stats,
      platformBreakdown,
      topPerformers,
      subscribedPlatforms,
    });
  } catch (err) {
    return apiError(err, 'historial');
  }
}
