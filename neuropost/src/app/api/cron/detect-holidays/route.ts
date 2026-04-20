// =============================================================================
// Cron: detect-holidays — runs monthly (1st of each month, 06:00 UTC)
// =============================================================================
// For each active brand whose holiday calendar hasn't been refreshed in the
// last 60 days, queues a scheduling:detect_holidays job for the current year
// and the next year.
//
// Brands that have never had events generated are prioritised (higher priority
// in the queue). Brands with recent events are re-queued with force_refresh=true
// only when they haven't been updated in 60+ days.
//
// vercel.json / cron config:
//   { "path": "/api/cron/detect-holidays", "schedule": "0 6 1 * *" }

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { queueJob } from '@/lib/agents/queue';
import '@/lib/agents/handlers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export const dynamic    = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth      = request.headers.get('authorization');
  const isVercel  = request.headers.get('x-vercel-cron') === '1';
  const secret    = process.env.CRON_SECRET ?? '';
  const validBearer = secret && auth === `Bearer ${secret}`;
  if (!isVercel && !validBearer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = createAdminClient() as DB;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);   // 60 days ago

    // Get all active brands with their last generation date
    const { data: brands, error } = await db
      .from('brands')
      .select('id, location, city, calendar_events_generated_at')
      .not('location', 'is', null);

    if (error) throw error;
    if (!brands?.length) return NextResponse.json({ ok: true, queued: 0 });

    const currentYear = new Date().getFullYear();
    let queued = 0;

    for (const brand of brands as Array<{ id: string; location: string; city?: string; calendar_events_generated_at?: string }>) {
      const lastGen = brand.calendar_events_generated_at ? new Date(brand.calendar_events_generated_at) : null;
      const needsRefresh = !lastGen || lastGen < cutoff;

      if (!needsRefresh) continue;

      const isFirstTime = !lastGen;
      const priority = isFirstTime ? 55 : 35;

      // Queue for current year + next year
      for (const yr of [currentYear, currentYear + 1]) {
        await queueJob({
          brand_id:     brand.id,
          agent_type:   'scheduling',
          action:       'detect_holidays',
          input: {
            year:          yr,
            force_refresh: !isFirstTime,   // only force on refresh, not first-time (handler dedupes)
          },
          priority,
          requested_by: 'cron',
        });
      }
      queued++;
    }

    return NextResponse.json({ ok: true, queued, total_brands: brands.length });
  } catch (err) {
    console.error('[cron/detect-holidays]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
