// =============================================================================
// Cron: monday-brain — Weekly master pipeline
// =============================================================================
// Every Monday at 00:00 UTC. THE central proactive cron that replaces the
// fragmented detect-trends / competitor-analysis / recompute-weights crons.
//
// For each active brand:
//   queueWeeklyPipeline() → 6 ordered steps with offset scheduling
//
// Batching: processes brands in chunks of 30 to avoid flooding the queue.
// Each brand's pipeline is time-staggered (2min between brands in the same
// batch) so the runner isn't overwhelmed.
//
// Global trends should already be fresh (ran Sunday 23:00 via global-trends).

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { queueWeeklyPipeline } from '@/lib/agents/pipelines/weekly';
import '@/lib/agents/handlers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // up to 5 min for many brands

const BATCH_SIZE = 30;
const INTER_BRAND_DELAY_MS = 500; // stagger to avoid queue spikes

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

    // All active brands (have a plan, not cancelled).
    const { data: brands } = await db
      .from('brands')
      .select('id')
      .not('plan', 'is', null);

    const ids = ((brands ?? []) as Array<{ id: string }>).map((b) => b.id);
    let queued = 0;
    let errors = 0;

    // Process in batches.
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      for (const brandId of batch) {
        try {
          await queueWeeklyPipeline(brandId);
          queued += 1;
        } catch (err) {
          errors += 1;
          console.error(`[monday-brain] failed for ${brandId}:`, err);
        }
        // Tiny stagger between brands in the same batch.
        if (INTER_BRAND_DELAY_MS > 0) {
          await new Promise((r) => setTimeout(r, INTER_BRAND_DELAY_MS));
        }
      }
    }

    return NextResponse.json({
      ok: true,
      total_brands: ids.length,
      pipelines_queued: queued,
      errors,
    });
  } catch (err) {
    console.error('[cron/monday-brain]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
