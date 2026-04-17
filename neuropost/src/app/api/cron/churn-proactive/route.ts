// =============================================================================
// Cron: proactive churn scan
// =============================================================================
// Daily at 09:00 UTC. For every active brand, enqueues one
// growth:churn_risk_scan job. The handler decides whether the brand is at
// risk (>14 days without publishing) and fans out a retention_email sub-job
// if so. Non-at-risk brands are no-ops.
//
// This is the proactive companion to the existing /api/cron/churn-analysis
// which is a batch Python-ish analyze pass. This one uses the agent queue
// so retention emails flow through the same observability as everything else.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { queueJob } from '@/lib/agents/queue';
import '@/lib/agents/handlers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export const dynamic = 'force-dynamic';
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

    // Only brands that have a plan (i.e. paying users — not trial-only).
    const { data: brands } = await db
      .from('brands')
      .select('id')
      .not('plan', 'is', null);

    const ids = ((brands ?? []) as Array<{ id: string }>).map((b) => b.id);

    let queued = 0;
    for (const brandId of ids) {
      try {
        await queueJob({
          brand_id:     brandId,
          agent_type:   'growth',
          action:       'churn_risk_scan',
          input:        { inactivity_days: 14 },
          priority:     25,
          requested_by: 'cron',
        });
        queued += 1;
      } catch (err) {
        console.error(`[churn-proactive] failed for ${brandId}:`, err);
      }
    }

    return NextResponse.json({ ok: true, brands: ids.length, queued });
  } catch (err) {
    console.error('[cron/churn-proactive]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
