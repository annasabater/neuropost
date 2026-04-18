// =============================================================================
// Cron: flush notifications_outbox — runs every minute
//
// Picks pending rows (oldest first), dispatches via the email pipeline used by
// notify(). On success: status='sent', sent_at=now(). On failure:
// increment retry_count; mark 'failed' once retries ≥ 5 and record last_error.
// =============================================================================

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { canSendEmail, type EmailType } from '@/lib/email/preferences';
import { enqueueEmail } from '@/lib/email/queue';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_RETRIES = 5;
const BATCH_SIZE  = 50;

// Mirror notify.ts mapping so the outbox processor routes email correctly.
const TYPE_TO_EMAIL: Record<string, EmailType> = {
  approval_needed:  'approval_needed',
  published:        'post_published',
  failed:           'post_failed',
  ticket_reply:     'ticket_reply',
  recreation_ready: 'recreation_ready',
  payment_failed:   'payment_failed',
};

interface OutboxRow {
  id:          string;
  brand_id:    string;
  type:        string;
  payload:     { message: string; metadata?: Record<string, unknown> };
  retry_count: number;
}

export async function GET(request: Request) {
  const auth     = request.headers.get('authorization');
  const isVercel = request.headers.get('x-vercel-cron') === '1';
  const secret   = process.env.CRON_SECRET ?? '';
  if (!isVercel && (!secret || auth !== `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db: DB = createAdminClient();

  const { data: rows, error } = await db
    .from('notifications_outbox')
    .select('id, brand_id, type, payload, retry_count')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error('[flush-notifications] query failed', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const results = { processed: 0, sent: 0, retried: 0, failed: 0 };

  for (const row of (rows ?? []) as OutboxRow[]) {
    results.processed += 1;
    try {
      await dispatch(db, row);
      await db.from('notifications_outbox').update({
        status:  'sent',
        sent_at: new Date().toISOString(),
      }).eq('id', row.id);
      results.sent += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const nextCount = row.retry_count + 1;
      const giveUp    = nextCount >= MAX_RETRIES;
      await db.from('notifications_outbox').update({
        status:      giveUp ? 'failed' : 'pending',
        retry_count: nextCount,
        last_error:  message.slice(0, 500),
      }).eq('id', row.id);
      if (giveUp) results.failed += 1; else results.retried += 1;
      console.warn(`[flush-notifications] ${row.id} attempt ${nextCount}/${MAX_RETRIES}: ${message}`);
    }
  }

  return NextResponse.json({ ok: true, ...results });
}

async function dispatch(db: DB, row: OutboxRow): Promise<void> {
  const emailType = TYPE_TO_EMAIL[row.type];
  if (!emailType) return; // no email mapping → consider delivered (in-app already sent)

  const gate = await canSendEmail(row.brand_id, emailType);
  if (!gate.allowed) return; // user preferences say no — treat as delivered

  const { data: brand } = await db
    .from('brands').select('timezone').eq('id', row.brand_id).maybeSingle();
  const tz = (brand?.timezone as string | null) || 'Europe/Madrid';

  const basePayload = {
    notif_type: row.type,
    message:    row.payload.message,
    metadata:   row.payload.metadata ?? {},
  };

  if (gate.frequency !== 'immediate') {
    await enqueueEmail({
      brandId:   row.brand_id,
      emailType,
      payload:   basePayload,
      frequency: gate.frequency,
      tz,
      preview:   row.payload.message.slice(0, 100),
    });
    return;
  }

  if (!gate.email) return;
  const { sendNotificationEmail } = await import('@/lib/email');
  await sendNotificationEmail({
    to:        gate.email,
    brandName: gate.brandName ?? 'Tu negocio',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type:      row.type as any,
    message:   row.payload.message,
    metadata:  row.payload.metadata ?? {},
    brandId:   row.brand_id,
  });
}
