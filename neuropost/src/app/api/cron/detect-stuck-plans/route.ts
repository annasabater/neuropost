// =============================================================================
// Cron: detect-stuck-plans — expire dead plans, alert on unnotified ones
// =============================================================================
// Runs every 15 minutes. Three independent cases:
//
//   A. Plans stuck in 'generating' > 10 min → expire (handler crashed)
//   B. Plans in 'ideas_ready' with worker unnotified > 30 min → alert only
//   C. Plans in 'ideas_ready'/'client_reviewing' abandoned > 7 days → expire

import { NextResponse }      from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { log }               from '@/lib/logger';
import { logSystemAction }   from '@/lib/audit';
import * as Sentry           from '@sentry/nextjs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export const dynamic     = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: Request) {
  const auth        = request.headers.get('authorization');
  const isVercel    = request.headers.get('x-vercel-cron') === '1';
  const secret      = process.env.CRON_SECRET ?? '';
  const validBearer = secret && auth === `Bearer ${secret}`;
  if (!isVercel && !validBearer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const t0 = Date.now();
    const db = createAdminClient() as DB;

    const tenMinutesAgo  = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const thirtyMinsAgo  = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const sevenDaysAgo   = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000).toISOString();

    // ─── Case A: stuck in 'generating' > 10 min ──────────────────────────────
    const { data: stuckGenerating } = await db
      .from('weekly_plans')
      .update({ status: 'expired', skip_reason: 'stuck_in_generating_over_10_minutes' })
      .eq('status', 'generating')
      .lt('created_at', tenMinutesAgo)
      .select('id, brand_id');

    for (const plan of stuckGenerating ?? []) {
      log({ level: 'error', scope: 'cron/detect-stuck-plans', event: 'plan_stuck_generating_expired',
            plan_id: plan.id, brand_id: plan.brand_id });
    }

    // ─── Case B: ideas_ready with worker unnotified > 30 min (alert only) ────
    const { data: unnotified } = await db
      .from('weekly_plans')
      .select('id, brand_id, worker_notify_status, created_at')
      .eq('status', 'ideas_ready')
      .in('worker_notify_status', ['pending', 'failed'])
      .lt('created_at', thirtyMinsAgo);

    for (const plan of unnotified ?? []) {
      log({ level: 'warn', scope: 'cron/detect-stuck-plans', event: 'plan_worker_unnotified',
            plan_id: plan.id, brand_id: plan.brand_id,
            worker_notify_status: plan.worker_notify_status,
            age_minutes: Math.round((Date.now() - new Date(plan.created_at).getTime()) / 60000) });
    }

    // ─── Case C: abandoned > 7 days ──────────────────────────────────────────
    const { data: abandoned } = await db
      .from('weekly_plans')
      .update({ status: 'expired', skip_reason: 'abandoned_over_7_days' })
      .in('status', ['ideas_ready', 'client_reviewing'])
      .lt('created_at', sevenDaysAgo)
      .select('id, brand_id, status');

    for (const plan of abandoned ?? []) {
      log({ level: 'info', scope: 'cron/detect-stuck-plans', event: 'plan_abandoned_expired',
            plan_id: plan.id, brand_id: plan.brand_id, previous_status: plan.status });
    }

    const response = {
      ok:                          true,
      stuck_generating_expired:    stuckGenerating?.length  ?? 0,
      stuck_unnotified_alerted:    unnotified?.length       ?? 0,
      abandoned_expired:           abandoned?.length        ?? 0,
      duration_ms:                 Date.now() - t0,
    };

    log({ level: 'info', scope: 'cron/detect-stuck-plans', event: 'run_complete', ...response });
    void logSystemAction('cron', 'detect_stuck_plans', 'system',
      `detect-stuck-plans: ${response.stuck_generating_expired} expired generating, ` +
      `${response.stuck_unnotified_alerted} unnotified alerts, ${response.abandoned_expired} abandoned expired`,
      { metadata: response });
    return NextResponse.json(response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log({ level: 'error', scope: 'cron/detect-stuck-plans', event: 'uncaught_error', error: msg });
    Sentry.captureException(err, { tags: { component: 'cron/detect-stuck-plans' },
      extra: { scope: 'cron/detect-stuck-plans' } });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
