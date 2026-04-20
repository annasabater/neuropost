// =============================================================================
// NEUROPOST — Cron: email-queue-processor
// Runs every 10 minutes. Picks pending email_queue rows with send_at <= now(),
// groups by brand_id, renders one digest email per brand when the batch has
// ≥2 items or the original single email when there is just one.
// Special handling for email_type='chat_message': skip (mark 'cancelled')
// if the underlying chat_messages row has read_at != null — user already
// saw the message.
// =============================================================================

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { canSendEmail, markEmailSent, type EmailType } from '@/lib/email/preferences';
import { getTemplate } from '@/lib/email/templates';
import { sendGatedRaw } from '@/lib/email/sendRaw';

export const runtime     = 'nodejs';
export const maxDuration = 120;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

const BATCH_LIMIT = 200;

// ─── Labels shown in the digest for each EmailType ──────────────────────────

const LABEL_ES: Partial<Record<EmailType, string>> = {
  approval_needed:  'Contenido listo para aprobar',
  ticket_reply:     'Respuesta en tu ticket',
  chat_message:     'Mensaje del equipo',
  recreation_ready: 'Recreación lista',
  comment_pending:  'Comentarios pendientes',
  token_expired:    'Conexión caducada',
  post_published:   'Post publicado',
  post_failed:      'Fallo al publicar',
  payment_failed:   'Problema con el pago',
  trial_ending:     'Tu prueba termina pronto',
  limit_reached:    'Límite alcanzado',
};
const LABEL_EN: Partial<Record<EmailType, string>> = {
  approval_needed:  'Content ready to approve',
  ticket_reply:     'Support ticket reply',
  chat_message:     'Team message',
  recreation_ready: 'Recreation ready',
  comment_pending:  'Pending comments',
  token_expired:    'Connection expired',
  post_published:   'Post published',
  post_failed:      'Publishing failed',
  payment_failed:   'Payment issue',
  trial_ending:     'Your trial is ending soon',
  limit_reached:    'Plan limit reached',
};

const CTA_PATH: Partial<Record<EmailType, string>> = {
  approval_needed:  '/posts',
  ticket_reply:     '/soporte',
  chat_message:     '/chat',
  recreation_ready: '/inspiracion',
  comment_pending:  '/comments',
  token_expired:    '/settings/connections',
  post_published:   '/posts',
  post_failed:      '/posts',
  payment_failed:   '/settings/plan',
  trial_ending:     '/settings/plan',
  limit_reached:    '/settings/plan',
};

interface QueuedRow {
  id:         string;
  brand_id:   string;
  email_type: EmailType;
  payload:    Record<string, unknown>;
  send_at:    string;
}

// ─── chat_message pre-flight: skip if already read ─────────────────────────

async function isChatMessageStillUnread(db: DB, row: QueuedRow): Promise<boolean> {
  const metadata = (row.payload?.metadata ?? {}) as Record<string, unknown>;
  const messageId = metadata.message_id as string | undefined;
  if (!messageId) return true; // no id → err on the side of sending

  const { data } = await db
    .from('chat_messages')
    .select('read_at')
    .eq('id', messageId)
    .maybeSingle();
  if (!data) return true;
  return data.read_at == null;
}

// ─── Handler ────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const got = request.headers.get('authorization');
  if (!cronSecret || got !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createAdminClient() as DB;
  const now = new Date().toISOString();

  const { data: rawRows, error } = await db
    .from('email_queue')
    .select('id, brand_id, email_type, payload, send_at')
    .eq('status', 'pending')
    .lte('send_at', now)
    .order('send_at', { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) {
    console.error('[email-queue-processor] pick failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!rawRows || rawRows.length === 0) {
    return NextResponse.json({ picked: 0, brands: 0, sent: 0 });
  }

  const rows = rawRows as QueuedRow[];

  // ── Pre-flight for chat_message: cancel rows whose message is now read ──
  const cancelIds: string[] = [];
  const viable:    QueuedRow[] = [];
  for (const r of rows) {
    if (r.email_type === 'chat_message') {
      const stillUnread = await isChatMessageStillUnread(db, r);
      if (!stillUnread) {
        cancelIds.push(r.id);
        continue;
      }
    }
    viable.push(r);
  }
  if (cancelIds.length > 0) {
    await db.from('email_queue').update({
      status: 'cancelled', last_error: 'message_already_read', sent_at: now,
    }).in('id', cancelIds);
  }

  // ── Group viable rows by brand ─────────────────────────────────────────
  const byBrand = new Map<string, QueuedRow[]>();
  for (const r of viable) {
    const arr = byBrand.get(r.brand_id) ?? [];
    arr.push(r);
    byBrand.set(r.brand_id, arr);
  }

  let sentCount = 0;
  const failedIds: Array<{ id: string; error: string }> = [];
  const sentIds:   string[] = [];

  for (const [brandId, group] of byBrand) {
    try {
      // Use the first row's type for the gate — digests use a permissive
      // 'daily_digest' gate when grouped, per-type gate when single.
      const isDigest = group.length > 1;
      const gateType: EmailType = isDigest ? 'daily_digest' : group[0].email_type;

      const gate = await canSendEmail(brandId, gateType);
      if (!gate.allowed) {
        // Leave pending rows as cancelled so we don't loop on them
        await db.from('email_queue').update({
          status: 'cancelled', last_error: `gate_denied:${gate.reason}`, sent_at: now,
        }).in('id', group.map(g => g.id));
        continue;
      }
      if (!gate.email) {
        await db.from('email_queue').update({
          status: 'cancelled', last_error: 'no_recipient', sent_at: now,
        }).in('id', group.map(g => g.id));
        continue;
      }

      if (isDigest) {
        // ── Render aggregated digest ──────────────────────────────────
        const LABEL = gate.language === 'en' ? LABEL_EN : LABEL_ES;
        const items = group.map(r => ({
          type:    r.email_type,
          label:   LABEL[r.email_type] ?? r.email_type,
          message: ((r.payload?.message as string | undefined) ?? '').slice(0, 300),
          href:    CTA_PATH[r.email_type],
        }));
        const factory = getTemplate('digest', gate.language);
        const { subject, html: body } = factory({
          brandName: gate.brandName ?? 'Tu negocio',
          frequency: 'daily',
          items,
        });
        await sendGatedRaw({ brandId, type: 'daily_digest', to: gate.email, subject, body });
        await markEmailSent(brandId, 'daily_digest', { count: items.length, ids: group.map(g => g.id) });

      } else {
        // ── Single row → render genericNotification with original payload ──
        const row = group[0];
        const notifType = (row.payload?.notif_type as string | undefined) ?? row.email_type;
        const message   = (row.payload?.message  as string | undefined) ?? '';
        const factory = getTemplate('genericNotification', gate.language);
        const { subject, html: body } = factory({
          brandName: gate.brandName ?? 'Tu negocio',
          type:      notifType,
          message,
        });
        await sendGatedRaw({ brandId, type: row.email_type, to: gate.email, subject, body });
        await markEmailSent(brandId, row.email_type, { from_queue: row.id });
      }

      sentIds.push(...group.map(g => g.id));
      sentCount += 1;

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[email-queue-processor] brand ${brandId} failed:`, msg);
      for (const r of group) failedIds.push({ id: r.id, error: msg });
    }
  }

  // Mark successes and failures in bulk
  if (sentIds.length > 0) {
    await db.from('email_queue').update({
      status: 'sent', sent_at: now,
    }).in('id', sentIds);
  }
  if (failedIds.length > 0) {
    // Update attempts + last_error; we leave status='pending' until attempts
    // reach 5 so transient errors can retry on the next tick.
    for (const f of failedIds) {
      await db.rpc('increment_email_attempts', { row_id: f.id, err: f.error }).catch(async () => {
        // Fallback when the RPC doesn't exist: plain update
        const { data } = await db.from('email_queue').select('attempts').eq('id', f.id).maybeSingle();
        const next = (data?.attempts ?? 0) + 1;
        await db.from('email_queue').update({
          attempts:   next,
          last_error: f.error,
          status:     next >= 5 ? 'failed' : 'pending',
        }).eq('id', f.id);
      });
    }
  }

  return NextResponse.json({
    picked:    rows.length,
    cancelled: cancelIds.length,
    brands:    byBrand.size,
    sent:      sentCount,
    failed:    failedIds.length,
  });
}
