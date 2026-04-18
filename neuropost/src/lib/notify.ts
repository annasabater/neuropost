// =============================================================================
// Unified notification helper — in-app + conditional email
// =============================================================================
// Single entry point for all notifications.
//   1. Always insert the in-app notification row
//   2. Per-type dispatch to email:
//      - chat_message → enqueue with send_at = now()+24h (processor sends only
//        if the underlying chat row is still unread). Not affected by
//        max_frequency because it already has its own delay rule.
//      - comment      → owned by /api/cron/comment-pending-reminder (not here)
//      - everything else mapped in TYPE_TO_EMAIL:
//          · max_frequency='immediate' → send now via sendNotificationEmail
//          · max_frequency='daily'/'weekly' → enqueue email_queue with
//            send_at = next digest window in the brand timezone
//
// Usage:
//   await notify(brandId, 'approval_needed', 'Tu contenido está listo', {
//     post_id: '...',
//   });

import { createAdminClient } from '@/lib/supabase';
import { canSendEmail, type EmailType } from './email/preferences';
import { enqueueEmail } from './email/queue';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

type NotifType =
  | 'approval_needed'
  | 'published'
  | 'failed'
  | 'comment'
  | 'ticket_reply'
  | 'chat_message'
  | 'recreation_ready'
  | 'limit_reached'
  | 'meta_connected'
  | 'token_expired'
  | 'tiktok_reconnect_required'
  | 'payment_failed'
  | 'plan_activated'
  | 'team_invite';

/** Notif type → gated EmailType. undefined means "no email". */
const TYPE_TO_EMAIL: Partial<Record<NotifType, EmailType>> = {
  approval_needed:           'approval_needed',
  published:                 'post_published',
  failed:                    'post_failed',
  ticket_reply:              'ticket_reply',
  chat_message:              'chat_message',       // deferred 24h via queue
  recreation_ready:          'recreation_ready',
  limit_reached:             'limit_reached',
  token_expired:             'token_expired',
  tiktok_reconnect_required: 'token_expired',
  payment_failed:            'payment_failed',
  // `comment` handled by the reminder cron.
};

const DEFER_24H_MS = 24 * 60 * 60 * 1000;

interface NotifyOpts {
  /** Skip email even if preferences allow it. */
  skipEmail?: boolean;
}

export async function notify(
  brandId:  string,
  type:     NotifType,
  message:  string,
  metadata: Record<string, unknown> = {},
  opts:     NotifyOpts = {},
): Promise<void> {
  const db = createAdminClient() as DB;

  // 1. Always insert in-app notification
  await db.from('notifications').insert({
    brand_id: brandId,
    type,
    message,
    read:     false,
    metadata,
  });

  if (opts.skipEmail) return;

  const emailType = TYPE_TO_EMAIL[type];
  if (!emailType) return;

  try {
    // Resolve preferences + timezone for this brand
    const gate = await canSendEmail(brandId, emailType);
    if (!gate.allowed) {
      // canSendEmail already logged the reason
      return;
    }

    // Get brand timezone for digest scheduling
    const { data: brand } = await db
      .from('brands')
      .select('timezone')
      .eq('id', brandId)
      .maybeSingle();
    const tz = (brand?.timezone as string | null) || 'Europe/Madrid';

    const basePayload = { notif_type: type, message, metadata };

    // 2. chat_message → always queue with +24h delay (read_at check at send)
    if (emailType === 'chat_message') {
      await enqueueEmail({
        brandId,
        emailType:  'chat_message',
        payload:    basePayload,
        frequency:  gate.frequency,     // if daily/weekly, sendAt may be later
        tz,
        delayMs:    DEFER_24H_MS,        // floor of 24h
        preview:    message.slice(0, 100),
      });
      return;
    }

    // 3. Digest mode (daily/weekly) → queue, do NOT send now
    if (gate.frequency !== 'immediate') {
      await enqueueEmail({
        brandId,
        emailType,
        payload:   basePayload,
        frequency: gate.frequency,
        tz,
        preview:   message.slice(0, 100),
      });
      return;
    }

    // 4. Immediate mode → send now
    if (!gate.email) return;
    const { sendNotificationEmail } = await import('./email');
    await sendNotificationEmail({
      to:        gate.email,
      brandName: gate.brandName ?? 'Tu negocio',
      type,
      message,
      metadata,
      brandId,
    });
  } catch (emailErr) {
    // Email failure must never block the caller.
    console.error(`[notify] email pipeline failed for ${type}:`, emailErr);
  }
}
