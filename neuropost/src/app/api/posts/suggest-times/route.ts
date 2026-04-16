// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/posts/suggest-times?platforms=instagram,facebook,tiktok&brandId=
//    → { suggestions: { instagram: ISO, facebook: ISO, tiktok: ISO },
//        source: 'analytics' | 'heuristic' }
//
//  Phase-5 implementation: aggregate over post_analytics (last 90 days)
//  grouped by (day_of_week, hour) and pick the slot with the highest
//  average reach for each platform. Fall back to a heuristic default
//  when the brand has <3 samples on a platform.
//
//  The response shape stays compatible with the phase-4 heuristic version
//  (the scheduler UI just consumes `suggestions`).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createAdminClient } from '@/lib/supabase';
import { parsePlatform, type Platform } from '@/lib/platforms';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

// Heuristic fallback — Spanish local-business audiences.
const DEFAULT_HOUR: Record<Platform, number> = {
  instagram: 19,
  facebook:  10,
  tiktok:    20,
};

const MIN_SAMPLES   = 3;      // require ≥3 posts at (dow, hour) to trust the slot
const LOOKBACK_DAYS = 90;

interface AnalyticsSlot {
  best_day:  number | null;
  best_hour: number | null;
  reach:     number | null;
}

/**
 * Find the next occurrence of (dayOfWeek, hour) in the future.
 * dayOfWeek follows our post_analytics convention: Mon = 0 … Sun = 6.
 */
function nextOccurrence(dayOfWeek: number, hour: number): Date {
  const now = new Date();
  // JS Date.getDay(): Sun = 0 … Sat = 6. Convert our Mon=0 scheme to that.
  const targetJsDay = (dayOfWeek + 1) % 7; // 0→1 (Mon→Mon), 6→0 (Sun→Sun)
  const d = new Date(now);
  d.setHours(hour, 0, 0, 0);
  const daysToAdd = ((targetJsDay - d.getDay() + 7) % 7) || 0;
  if (daysToAdd === 0 && d.getTime() <= now.getTime()) {
    d.setDate(d.getDate() + 7);
  } else {
    d.setDate(d.getDate() + daysToAdd);
  }
  return d;
}

function tomorrowAt(hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function suggestFromAnalytics(
  db:       DB,
  brandId:  string,
  platform: Platform,
): Promise<Date | null> {
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();
  const { data } = await db
    .from('post_analytics')
    .select('best_day, best_hour, reach')
    .eq('brand_id', brandId)
    .eq('platform', platform)
    .not('best_day',  'is', null)
    .not('best_hour', 'is', null)
    .gte('published_at', cutoff);

  const rows = (data ?? []) as AnalyticsSlot[];
  if (rows.length < MIN_SAMPLES) return null;

  // Bucket by (dow, hour), average reach, pick the highest slot whose
  // bucket has enough samples to be trustworthy.
  const buckets = new Map<string, { dow: number; hour: number; totalReach: number; samples: number }>();
  for (const r of rows) {
    if (r.best_day == null || r.best_hour == null) continue;
    const key = `${r.best_day}-${r.best_hour}`;
    const prev = buckets.get(key) ?? { dow: r.best_day, hour: r.best_hour, totalReach: 0, samples: 0 };
    prev.totalReach += r.reach ?? 0;
    prev.samples    += 1;
    buckets.set(key, prev);
  }

  const ranked = Array.from(buckets.values())
    .filter(b => b.samples >= Math.min(MIN_SAMPLES, 2))   // slot-level floor
    .map(b => ({ ...b, avgReach: b.samples > 0 ? b.totalReach / b.samples : 0 }))
    .sort((a, b) => b.avgReach - a.avgReach);

  if (ranked.length === 0) return null;
  const top = ranked[0]!;
  return nextOccurrence(top.dow, top.hour);
}

export async function GET(request: Request) {
  try {
    const user = await requireServerUser();
    const db   = createAdminClient() as DB;

    const url        = new URL(request.url);
    const rawParam   = url.searchParams.get('platforms') ?? 'instagram,facebook,tiktok';
    const brandIdArg = url.searchParams.get('brandId');
    const asked      = rawParam.split(',').map(s => s.trim()).filter(Boolean);

    // Resolve brand: either explicit ?brandId for workers, or the user's own.
    let brandId: string | null = brandIdArg;
    if (!brandId) {
      const { data: ownBrand } = await db
        .from('brands').select('id').eq('user_id', user.id).maybeSingle();
      brandId = ownBrand?.id ?? null;
    }

    const suggestions: Partial<Record<Platform, string>> = {};
    let usedAnalyticsCount   = 0;
    let usedHeuristicCount   = 0;

    for (const raw of asked) {
      const platform = parsePlatform(raw);
      if (!platform) continue;

      let pick: Date | null = null;
      if (brandId) {
        pick = await suggestFromAnalytics(db, brandId, platform);
      }
      if (pick) {
        usedAnalyticsCount++;
      } else {
        pick = tomorrowAt(DEFAULT_HOUR[platform]);
        usedHeuristicCount++;
      }
      suggestions[platform] = pick.toISOString();
    }

    return NextResponse.json({
      suggestions,
      source:
        usedAnalyticsCount > 0 && usedHeuristicCount === 0 ? 'analytics' :
        usedAnalyticsCount > 0 && usedHeuristicCount > 0  ? 'mixed'     :
        'heuristic',
      lookbackDays: LOOKBACK_DAYS,
    });
  } catch (err) {
    return apiError(err, 'GET /api/posts/suggest-times');
  }
}
