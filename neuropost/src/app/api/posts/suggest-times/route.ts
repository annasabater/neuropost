// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/posts/suggest-times?platforms=instagram,facebook,tiktok
//    → { suggestions: { instagram: ISO, facebook: ISO, tiktok: ISO } }
//
//  Phase-4 heuristic: hard-coded "known good" slots for local-business
//  audiences — tomorrow at the best window for each platform. Phase 5
//  will replace the core with an aggregate query over post_analytics
//  (dow × hour × avg_reach), but we need a working endpoint NOW so the
//  /posts/new form can wire up "Sugerir horas óptimas".
//
//  Keep the response shape stable so the UI doesn't need to change
//  when the backend implementation evolves.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { parsePlatform, type Platform } from '@/lib/platforms';

// Empirical "good hour" for Spanish local-business audiences.
// Numbers are conservative defaults used by most social-media handbooks.
const DEFAULT_HOUR: Record<Platform, number> = {
  instagram: 19,   // weekday evenings, pre-dinner
  facebook:  10,   // morning engagement window
  tiktok:    20,   // late evening, high FYP activity
};

/** ISO string for "tomorrow at hour:00 in Europe/Madrid" relative to now. */
function tomorrowAt(hour: number): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export async function GET(request: Request) {
  try {
    const url      = new URL(request.url);
    const rawParam = url.searchParams.get('platforms') ?? 'instagram,facebook,tiktok';
    const asked    = rawParam.split(',').map(s => s.trim()).filter(Boolean);

    const suggestions: Partial<Record<Platform, string>> = {};
    for (const raw of asked) {
      const platform = parsePlatform(raw);
      if (!platform) continue;
      suggestions[platform] = tomorrowAt(DEFAULT_HOUR[platform]);
    }

    return NextResponse.json({
      suggestions,
      source: 'heuristic',   // phase 5 will flip this to 'analytics'
    });
  } catch (err) {
    return apiError(err, 'GET /api/posts/suggest-times');
  }
}
