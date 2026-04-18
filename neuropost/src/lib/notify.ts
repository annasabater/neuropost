// =============================================================================
// Unified notification helper — in-app + conditional email
// =============================================================================
// Single entry point for all notifications.
//   1. Always insert the in-app notification row
//   2. Per-type dispatch to email:
//      - chat_message → defer 24h via email_queue (N6 processor sends only if
//        the underlying chat row still has read_at = null)
//      - comment      → handled by a separate cron (comment-pending-reminder)
//                       that scans comments table; notify() does NOT send
//                       email directly for this type
//      - anything else with a mapped EmailType → send immediately via
//        sendNotificationEmail(), which handles canSendEmail + language +
//        unsubscribe footer + markEmailSent.
//
// Usage:
//   await notify(brandId, 'approval_needed', 'Tu contenido está listo', {
//     post_id: '...',
//   });

import { createAdminClient } from '@/lib/supabase';
import type { EmailType } from './email/preferences';

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
  tiktok_reconnect_required: 'token_expired',      // same email, different notif
  payment_failed:            'payment_failed',
  // NOTE: `comment` intentionally NOT here. It's handled by the
  // comment-pending-reminder cron to enforce the >24h-silent rule without
  // spamming on every new comment.
  // NOTE: `meta_connected`, `plan_activated`, `team_invite` are handled
  // elsewhere (Stripe webhook, team invite route) — no email from notify().
};

const DEFERRED_TYPES: ReadonlySet<EmailType> = new Set<EmailType>([
  'chat_message',
]);

const DEFER_MS = 24 * 60 * 60 * 1000; // 24h

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
    // 2. Deferred types → email_queue (processor in N6 checks preconditions)
    if (DEFERRED_TYPES.has(emailType)) {
      await db.from('email_queue').insert({
        brand_id:   brandId,
        email_type: emailType,
        // Subject + preview are rendered at send time by the processor using
        // the brand's language; leave a placeholder here so NOT NULL holds.
        subject: '(deferred)',
        preview: message.slice(0, 100),
        payload: {
          notif_type: type,
          message,
          metadata,
        },
        send_at: new Date(Date.now() + DEFER_MS).toISOString(),
        status:  'pending',
      });
      return;
    }

    // 3. Immediate types → send via the shared email layer
    const { data: brand } = await db
      .from('brands')
      .select('name, user_id')
      .eq('id', brandId)
      .single();
    if (!brand) return;

    const { data: userRes } = await db.auth.admin.getUserById(brand.user_id);
    const recipient = userRes?.user?.email;
    if (!recipient) return;

    const { sendNotificationEmail } = await import('./email');
    await sendNotificationEmail({
      to:        recipient,
      brandName: brand.name ?? 'Tu negocio',
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
