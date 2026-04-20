// =============================================================================
// GET /api/dashboard/metrics — real engagement metrics for client dashboard
// =============================================================================
// Returns current week stats + comparison with previous week.
// Sources: post_analytics (real IG data) + posts table (counts).

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

function mondayOf(d: Date): string {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const user = await requireServerUser();
    const db = createAdminClient() as DB;

    const { data: brand } = await db.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const now = new Date();
    const thisWeekStart = mondayOf(now);
    const lastWeekStart = mondayOf(new Date(now.getTime() - 7 * 86_400_000));

    // Fetch this week's analytics
    const { data: thisWeekAnalytics } = await db
      .from('post_analytics')
      .select('impressions, reach, likes, comments, saves, shares, engagement_rate, best_hour')
      .eq('brand_id', brand.id)
      .gte('published_at', thisWeekStart);

    // Fetch last week's analytics
    const { data: lastWeekAnalytics } = await db
      .from('post_analytics')
      .select('impressions, reach, likes, comments, saves, shares, engagement_rate')
      .eq('brand_id', brand.id)
      .gte('published_at', lastWeekStart)
      .lt('published_at', thisWeekStart);

    // Fetch post counts
    const { count: publishedThisWeek } = await db
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brand.id)
      .eq('status', 'published')
      .gte('published_at', thisWeekStart);

    const { count: publishedLastWeek } = await db
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brand.id)
      .eq('status', 'published')
      .gte('published_at', lastWeekStart)
      .lt('published_at', thisWeekStart);

    const { count: pendingCount } = await db
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brand.id)
      .eq('status', 'pending');

    const { count: scheduledCount } = await db
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brand.id)
      .eq('status', 'scheduled');

    // Aggregate metrics
    function sum(rows: Record<string, number>[], field: string): number {
      return (rows ?? []).reduce((acc, r) => acc + (r[field] ?? 0), 0);
    }
    function avg(rows: Record<string, number>[], field: string): number {
      if (!rows?.length) return 0;
      return sum(rows, field) / rows.length;
    }
    function pctChange(current: number, previous: number): number | null {
      if (previous === 0) return current > 0 ? 100 : null;
      return Math.round(((current - previous) / previous) * 100);
    }

    const tw = (thisWeekAnalytics ?? []) as Record<string, number>[];
    const lw = (lastWeekAnalytics ?? []) as Record<string, number>[];

    const thisImpressions = sum(tw, 'impressions');
    const lastImpressions = sum(lw, 'impressions');
    const thisReach       = sum(tw, 'reach');
    const lastReach       = sum(lw, 'reach');
    const thisLikes       = sum(tw, 'likes');
    const thisComments    = sum(tw, 'comments');
    const thisSaves       = sum(tw, 'saves');
    const thisShares      = sum(tw, 'shares');
    const thisEngagement  = avg(tw, 'engagement_rate');
    const lastEngagement  = avg(lw, 'engagement_rate');

    // Best hour from this week's data
    const hours = tw.map((r) => r.best_hour).filter((h) => h != null);
    const bestHour = hours.length > 0
      ? Math.round(hours.reduce((a, b) => a + b, 0) / hours.length)
      : null;

    return NextResponse.json({
      thisWeek: {
        posts:          publishedThisWeek ?? 0,
        impressions:    thisImpressions,
        reach:          thisReach,
        likes:          thisLikes,
        comments:       thisComments,
        saves:          thisSaves,
        shares:         thisShares,
        engagementRate: Math.round(thisEngagement * 100) / 100,
        bestHour,
      },
      changes: {
        impressions: pctChange(thisImpressions, lastImpressions),
        reach:       pctChange(thisReach, lastReach),
        engagement:  pctChange(thisEngagement, lastEngagement),
        posts:       pctChange(publishedThisWeek ?? 0, publishedLastWeek ?? 0),
      },
      counts: {
        pending:   pendingCount ?? 0,
        scheduled: scheduledCount ?? 0,
      },
    });
  } catch (err) {
    return apiError(err, 'GET /api/dashboard/metrics');
  }
}
