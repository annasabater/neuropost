// =============================================================================
// Cron: reconcile-client-emails — retry failed client review emails
// =============================================================================
// Runs every 5 minutes. Picks weekly_plans where client_email_status='failed'
// and client_email_attempts < 3, then calls enqueueClientReviewEmail().
//
// enqueueClientReviewEmail() (Fase 1) already:
//   - Returns { ok, error? }
//   - Updates client_email_status to 'sent' or 'failed'
//   - Increments client_email_attempts via RPC (best-effort)
//
// Claim pattern: UPDATE status to 'pending' WHERE status='failed' — only one
// concurrent cron invocation can claim a given plan.

import { NextResponse }              from 'next/server';
import { createAdminClient }         from '@/lib/supabase';
import { enqueueClientReviewEmail }  from '@/lib/planning/trigger-client-email';
import { log }                       from '@/lib/logger';
import { logSystemAction }           from '@/lib/audit';
import * as Sentry                   from '@sentry/nextjs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export const dynamic     = 'force-dynamic';
export const maxDuration = 60;

const MAX_ATTEMPTS = 3;
const PICK_LIMIT   = 10;

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

    // ─── 1. Query candidates ──────────────────────────────────────────────────
    const { data: candidates, error: queryErr } = await db
      .from('weekly_plans')
      .select('id, client_email_attempts')
      .eq('client_email_status', 'failed')
      .lt('client_email_attempts', MAX_ATTEMPTS)
      .order('created_at', { ascending: true })
      .limit(PICK_LIMIT);

    if (queryErr) {
      log({ level: 'error', scope: 'cron/reconcile-client-emails', event: 'query_failed',
            error: queryErr.message });
      return NextResponse.json({ ok: false, error: queryErr.message }, { status: 500 });
    }

    if (!candidates?.length) {
      return NextResponse.json({ ok: true, picked: 0, duration_ms: Date.now() - t0 });
    }

    // ─── 2. Process each candidate ────────────────────────────────────────────
    let retried           = 0;
    let succeeded         = 0;
    let stillFailed       = 0;
    let permanentlyFailed = 0;

    for (const plan of candidates as { id: string; client_email_attempts: number }[]) {
      // Atomic claim: transition 'failed' → 'pending' to prevent duplicate sends
      const { data: claimed } = await db
        .from('weekly_plans')
        .update({ client_email_status: 'pending' })
        .eq('id', plan.id)
        .eq('client_email_status', 'failed')
        .select('id');

      if (!claimed?.length) {
        // Another cron invocation claimed this plan — skip
        log({ level: 'info', scope: 'cron/reconcile-client-emails', event: 'plan_already_claimed',
              plan_id: plan.id });
        continue;
      }

      retried++;

      let result: { ok: boolean; error?: string };
      try {
        result = await enqueueClientReviewEmail(plan.id);
      } catch (err) {
        // Unexpected throw (e.g. Resend network error) — treat as failed, don't crash the cron
        const msg = err instanceof Error ? err.message : String(err);
        log({ level: 'error', scope: 'cron/reconcile-client-emails', event: 'email_threw',
              plan_id: plan.id, error: msg });
        Sentry.captureException(err, { tags: { component: 'cron/reconcile-client-emails' },
          extra: { scope: 'cron/reconcile-client-emails', plan_id: plan.id } });
        await db.from('weekly_plans')
          .update({ client_email_status: 'failed' })
          .eq('id', plan.id);
        result = { ok: false, error: msg };
      }

      if (result.ok) {
        succeeded++;
        log({ level: 'info', scope: 'cron/reconcile-client-emails', event: 'email_retry_succeeded',
              plan_id: plan.id });
      } else {
        stillFailed++;
        const nextAttempts = plan.client_email_attempts + 1;
        if (nextAttempts >= MAX_ATTEMPTS) {
          permanentlyFailed++;
          log({ level: 'error', scope: 'cron/reconcile-client-emails', event: 'email_permanently_failed',
                plan_id: plan.id, attempts: nextAttempts, error: result.error });
        } else {
          log({ level: 'warn', scope: 'cron/reconcile-client-emails', event: 'email_retry_failed',
                plan_id: plan.id, attempts: nextAttempts, error: result.error });
        }
      }
    }

    const response = {
      ok:                  true,
      picked:              candidates.length,
      retried,
      succeeded,
      still_failed:        stillFailed,
      permanently_failed:  permanentlyFailed,
      duration_ms:         Date.now() - t0,
    };

    log({ level: 'info', scope: 'cron/reconcile-client-emails', event: 'run_complete', ...response });
    void logSystemAction('cron', 'reconcile_client_emails', 'system',
      `reconcile-client-emails: ${succeeded} succeeded, ${permanentlyFailed} permanently failed`,
      { metadata: response });
    return NextResponse.json(response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log({ level: 'error', scope: 'cron/reconcile-client-emails', event: 'uncaught_error', error: msg });
    Sentry.captureException(err, { tags: { component: 'cron/reconcile-client-emails' },
      extra: { scope: 'cron/reconcile-client-emails' } });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
