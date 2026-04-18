// =============================================================================
// Unified notification helper — in-app + conditional email
// =============================================================================
// Single entry point for all notifications. Inserts into the `notifications`
// table AND sends an email if the brand's preferences allow it.
//
// Usage:
//   await notify(brandId, 'post_ready', 'Tu contenido está listo', {
//     post_id: '...',
//   });

import { createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

type NotifType =
  | 'approval_needed'  // post ready for review
  | 'published'        // post published
  | 'failed'           // generation failed
  | 'comment'          // new IG comment
  | 'ticket_reply'     // support ticket reply
  | 'chat_message'     // worker message
  | 'recreation_ready' // recreation done
  | 'limit_reached'    // plan limit hit
  | 'meta_connected'   // instagram linked
  | 'token_expired'    // meta token expired
  | 'payment_failed'   // stripe payment failed
  | 'plan_activated'   // subscription activated
  | 'team_invite';     // team invite

// Map notification type → preference column name
const TYPE_TO_PREF: Partial<Record<NotifType, string>> = {
  approval_needed:  'post_ready_email',
  published:        'post_published_email',
  comment:          'comment_email',
  ticket_reply:     'ticket_reply_email',
  chat_message:     'post_ready_email',      // group with post_ready
  recreation_ready: 'post_ready_email',
  failed:           'post_ready_email',
  limit_reached:    'plan_alert_email',
  token_expired:    'plan_alert_email',
  payment_failed:   'plan_alert_email',
  plan_activated:   'plan_alert_email',
};

interface NotifyOpts {
  /** Skip email even if preferences allow it */
  skipEmail?: boolean;
}

/**
 * Send an in-app notification + optional email based on brand preferences.
 */
export async function notify(
  brandId: string,
  type: NotifType,
  message: string,
  metadata: Record<string, unknown> = {},
  opts: NotifyOpts = {},
): Promise<void> {
  const db = createAdminClient() as DB;

  // 1. Always insert in-app notification
  await db.from('notifications').insert({
    brand_id: brandId,
    type,
    message,
    read: false,
    metadata,
  });

  // 2. Check email preferences
  if (opts.skipEmail) return;

  const prefColumn = TYPE_TO_PREF[type];
  if (!prefColumn) return; // no email mapping for this type

  try {
    const { data: prefs } = await db
      .from('notification_preferences')
      .select(prefColumn)
      .eq('brand_id', brandId)
      .maybeSingle();

    // Default to true if no preferences row exists
    const shouldEmail = prefs ? (prefs as Record<string, boolean>)[prefColumn] !== false : true;
    if (!shouldEmail) return;

    // 3. Load brand + user email
    const { data: brand } = await db
      .from('brands')
      .select('name, user_id')
      .eq('id', brandId)
      .single();
    if (!brand) return;

    const { data: { user } } = await db.auth.admin.getUserById(brand.user_id);
    if (!user?.email) return;

    // 4. Send email based on type — include brandId so the email layer can
    // resolve preferences/footer via canSendEmail/markEmailSent.
    const { sendNotificationEmail } = await import('./email');
    await sendNotificationEmail({
      to:        user.email,
      brandName: brand.name ?? 'Tu negocio',
      type,
      message,
      metadata,
      brandId,
    });
  } catch (emailErr) {
    // Email failure must never block the caller
    console.error(`[notify] email failed for ${type}:`, emailErr);
  }
}
