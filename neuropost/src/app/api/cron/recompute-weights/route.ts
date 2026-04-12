// =============================================================================
// Cron: weekly category-weight recomputation
// =============================================================================
// Every Monday at 06:00 UTC. For each active brand, queues one
// analytics:recompute_weights job. The agent-queue-runner picks them up
// within the next minute.
//
// We don't inline the recompute here to:
//   1. Keep this handler fast (bulk enqueue vs bulk DB writes)
//   2. Let the queue deduplicate: if a manual recompute already ran today,
//      the extra one just wastes a tick, not a cron slot.
//
// Same bearer-token guard as every other cron in the project.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { queueJob } from '@/lib/agents/queue';

// Side-effect import so handlers are registered if this route is hit before
// the queue runner on a cold start.
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

    // Only brands that have at least one category — others have nothing
    // to recompute.
    const { data: brandIds } = await db
      .from('content_categories')
      .select('brand_id')
      .limit(10_000);

    const uniqueBrandIds = Array.from(new Set(
      ((brandIds ?? []) as Array<{ brand_id: string }>).map((r) => r.brand_id),
    ));

    let queued = 0;
    for (const brandId of uniqueBrandIds) {
      try {
        await queueJob({
          brand_id:     brandId,
          agent_type:   'analytics',
          action:       'recompute_weights',
          input:        {},
          priority:     30, // low: doesn't block user-facing jobs
          requested_by: 'cron',
        });
        queued += 1;
      } catch (err) {
        console.error(`[recompute-weights] queue failed for ${brandId}:`, err);
      }
    }

    return NextResponse.json({ ok: true, brands: uniqueBrandIds.length, queued });
  } catch (err) {
    console.error('[cron/recompute-weights]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
