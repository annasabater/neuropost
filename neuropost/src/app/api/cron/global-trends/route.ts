// =============================================================================
// Cron: global-trends — Sunday 23:00 UTC
// =============================================================================
// Runs BEFORE monday-brain so the weekly pipeline has fresh trends.
// Queues:
//   1. One analytics:scan_trends job with sector_key = null (global)
//   2. One per active sector (unique sectors from all brands)
//
// The scan_trends handler deduplicates internally (skips if this week
// already scanned), so re-running this cron is safe.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { queueJob } from '@/lib/agents/queue';
import '@/lib/agents/handlers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET ?? ''}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = createAdminClient() as DB;

    // 1. Global trends.
    await queueJob({
      agent_type:   'analytics',
      action:       'scan_trends',
      input:        { sector_key: null },
      priority:     35,
      requested_by: 'cron',
    });

    // 2. Unique sectors from all active brands.
    const { data: brands } = await db
      .from('brands')
      .select('sector')
      .not('plan', 'is', null)
      .not('sector', 'is', null);

    const sectors = Array.from(new Set(
      ((brands ?? []) as Array<{ sector: string }>).map((b) => b.sector).filter(Boolean),
    ));

    let queued = 1; // global already queued
    for (const sector of sectors) {
      try {
        await queueJob({
          agent_type:   'analytics',
          action:       'scan_trends',
          input:        { sector_key: sector },
          priority:     30,
          requested_by: 'cron',
        });
        queued += 1;
      } catch (err) {
        console.error(`[global-trends] failed for sector ${sector}:`, err);
      }
    }

    return NextResponse.json({ ok: true, sectors: sectors.length + 1, queued });
  } catch (err) {
    console.error('[cron/global-trends]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
