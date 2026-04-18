// =============================================================================
// NEUROPOST — Email via Resend
// Every gated email (non-transactional) routes through sendGated():
//   canSendEmail() → resolves language + checks opt-out/anti-spam
//   getTemplate(name, language) → produces subject/html/preview
//   layoutWithUnsubscribe() → wraps with logo header + unsubscribe footer
//   markEmailSent() → writes anti-spam timestamp + activity_log
// Transactional emails (welcome, password_reset, etc.) render with the
// recipient's locale when we can resolve it, but never get the unsubscribe
// footer and never check preferences.
// =============================================================================

import { Resend } from 'resend';
import {
  canSendEmail, markEmailSent, TRANSACTIONAL_TYPES,
  normalizeLocale, type EmailType, type SupportedLanguage,
} from './email/preferences';
import { buildEmailFooter, getPreferencesUrl } from './email/unsubscribe';
import { getTemplate, getTemplateSet } from './email/templates';
import { createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY is not set');
    _resend = new Resend(key);
  }
  return _resend;
}

const FROM = () => process.env.RESEND_FROM_EMAIL ?? 'noreply@neuropost.app';
const APP  = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://neuropost.app';

// ─── Shared layout wrappers ────────────────────────────────────────────────

const BASE = `font-family:'Inter',Arial,sans-serif;background:#fdf8f3;color:#1a1a1a;margin:0;padding:0;`;
const CARD = `max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,0.08);`;
const LOGO = `font-size:24px;font-weight:800;color:#ff6b35;text-decoration:none;letter-spacing:-0.5px;`;
const MUTED = `font-size:13px;color:#888;margin-top:32px;border-top:1px solid #eee;padding-top:16px;`;

/** Plain layout for transactional emails — no unsubscribe. */
function layout(content: string): string {
  return `<!DOCTYPE html><html><body style="${BASE}">
    <div style="${CARD}">
      <a href="${APP()}" style="${LOGO}">NeuroPost</a>
      ${content}
      <p style="${MUTED}">© ${new Date().getFullYear()} NeuroPost · <a href="${getPreferencesUrl()}" style="color:#888">Gestionar notificaciones</a></p>
    </div>
  </body></html>`;
}

/** Layout for gated emails — appends the per-type unsubscribe footer. */
async function layoutWithUnsubscribe(
  content: string,
  brandId: string,
  type:    EmailType | string,
): Promise<string> {
  const unsub = await buildEmailFooter(brandId, type);
  return `<!DOCTYPE html><html><body style="${BASE}">
    <div style="${CARD}">
      <a href="${APP()}" style="${LOGO}">NeuroPost</a>
      ${content}
      <p style="${MUTED}">© ${new Date().getFullYear()} NeuroPost · <a href="${getPreferencesUrl()}" style="color:#888">Gestionar notificaciones</a></p>
      ${unsub}
    </div>
  </body></html>`;
}

// ─── Low-level send ────────────────────────────────────────────────────────

async function sendRaw(to: string, subject: string, html: string): Promise<void> {
  await getResend().emails.send({ from: FROM(), to, subject, html });
}

// ─── Language resolution for transactional paths (no brandId) ──────────────

/**
 * Best-effort language lookup when we only have an email address, not a
 * brand id. admin.listUsers is paginated; we use a filter query to find
 * the user and then read profiles.language.
 */
async function resolveLanguageFromEmail(email: string): Promise<SupportedLanguage> {
  if (!email) return 'es';
  try {
    const db = createAdminClient() as DB;
    // auth.admin.listUsers supports a filter on email via the `filter` option.
    const { data: listed } = await db.auth.admin.listUsers({
      page: 1, perPage: 1, filter: `email eq "${email.replace(/"/g, '\\"')}"`,
    });
    const userId = listed?.users?.[0]?.id as string | undefined;
    if (!userId) return 'es';

    const { data: profile } = await db
      .from('profiles')
      .select('language')
      .eq('id', userId)
      .maybeSingle();
    if (profile?.language) return normalizeLocale(profile.language);
  } catch { /* noop */ }
  return 'es';
}

// ─── Gated send (used by all non-transactional helpers) ────────────────────

async function sendGated(params: {
  brandId:  string;
  type:     EmailType;
  /** Template name that produces { subject, html, preview } for this type. */
  template: keyof ReturnType<typeof getTemplateSet>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props:    any;
  /** Optional override (defaults to the brand's primary user email). */
  to?: string;
}): Promise<boolean> {
  const gate = await canSendEmail(params.brandId, params.type);
  if (!gate.allowed) {
    console.log(`[email] skip ${params.type} for brand ${params.brandId}: ${gate.reason}`);
    return false;
  }
  const recipient = params.to ?? gate.email;
  if (!recipient) {
    console.warn(`[email] no recipient for ${params.type} brand ${params.brandId}`);
    return false;
  }

  // Auto-fill brandName if the template's props expose one and the caller
  // didn't set it — we already resolved the brand in canSendEmail.
  const propsWithBrand = (gate.brandName && typeof params.props === 'object' && params.props)
    ? { ...params.props, brandName: (params.props as { brandName?: string }).brandName || gate.brandName }
    : params.props;

  const factory = getTemplate(params.template, gate.language);
  const { subject, html: body } = factory(propsWithBrand);
  const html = await layoutWithUnsubscribe(body, params.brandId, params.type);

  await sendRaw(recipient, subject, html);
  await markEmailSent(params.brandId, params.type);
  return true;
}

// ─── 1. Welcome (transactional) ────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  const locale = await resolveLanguageFromEmail(to);
  const { subject, html: body } = getTemplate('welcome', locale)({ name });
  await sendRaw(to, subject, layout(body));
}

// ─── 2. Plan activated (transactional) ─────────────────────────────────────

export async function sendPlanActivatedEmail(
  to:             string,
  plan:           string,
  nextBillingDate: string,
): Promise<void> {
  const locale = await resolveLanguageFromEmail(to);
  const { subject, html: body } = getTemplate('planActivated', locale)({ plan, nextBillingDate });
  await sendRaw(to, subject, layout(body));
}

// ─── 3. Payment failed (gated: payment_failed) ─────────────────────────────

export async function sendPaymentFailedEmail(
  to:        string,
  portalUrl: string,
  brandId?:  string,
): Promise<void> {
  if (brandId) {
    await sendGated({ brandId, type: 'payment_failed', template: 'paymentFailed', props: { portalUrl }, to });
    return;
  }
  // Legacy path — no brandId. Still critical so we bypass the gate.
  const locale = await resolveLanguageFromEmail(to);
  const { subject, html: body } = getTemplate('paymentFailed', locale)({ portalUrl });
  await sendRaw(to, subject, layout(body));
}

// ─── 4. Post published (gated: post_published) ─────────────────────────────

export async function sendPostPublishedEmail(
  to:       string,
  postId:   string,
  platform: string,
  brandId?: string,
): Promise<void> {
  if (brandId) {
    await sendGated({ brandId, type: 'post_published', template: 'postPublished', props: { postId, platform }, to });
    return;
  }
  const locale = await resolveLanguageFromEmail(to);
  const { subject, html: body } = getTemplate('postPublished', locale)({ postId, platform });
  await sendRaw(to, subject, layout(body));
}

// ─── 5. Weekly report (gated: weekly_report) ───────────────────────────────

export async function sendWeeklyReportEmail(
  to:        string,
  brandName: string,
  stats:     { posts: number; reach: number; engagement: string; topPost?: string },
  brandId?:  string,
): Promise<void> {
  if (brandId) {
    await sendGated({ brandId, type: 'weekly_report', template: 'weeklyReport', props: { brandName, stats }, to });
    return;
  }
  const locale = await resolveLanguageFromEmail(to);
  const { subject, html: body } = getTemplate('weeklyReport', locale)({ brandName, stats });
  await sendRaw(to, subject, layout(body));
}

// ─── 6. Reset password (transactional) ─────────────────────────────────────

export async function sendResetPasswordEmail(to: string, resetLink: string): Promise<void> {
  const locale = await resolveLanguageFromEmail(to);
  const { subject, html: body } = getTemplate('resetPassword', locale)({ resetLink });
  await sendRaw(to, subject, layout(body));
}

// ─── 7. Team invite (transactional) ────────────────────────────────────────

export async function sendTeamInviteEmail(
  to:          string,
  inviterName: string,
  brandName:   string,
  role:        string,
  inviteUrl:   string,
): Promise<void> {
  const locale = await resolveLanguageFromEmail(to);
  const { subject, html: body } = getTemplate('teamInvite', locale)({ inviterName, brandName, role, inviteUrl });
  await sendRaw(to, subject, layout(body));
}

// ─── 8. Urgent support ticket (transactional, internal) ────────────────────

export async function sendUrgentTicketEmail(opts: {
  to:          string;
  brandName:   string;
  subject:     string;
  description: string;
  category:    string;
  ticketId:    string;
  clientEmail: string;
}): Promise<void> {
  // Internal worker email — always in the worker's language. Worker's brand
  // id is not available here, so we default to 'es' to keep behaviour stable.
  const { subject: subj, html: body } = getTemplate('urgentTicket', 'es')({
    brandName:   opts.brandName,
    subject:     opts.subject,
    description: opts.description,
    category:    opts.category,
    ticketId:    opts.ticketId,
    clientEmail: opts.clientEmail,
  });
  await sendRaw(opts.to, subj, layout(body));
}

// ─── 9. Subscription cancelled (transactional) ─────────────────────────────

export async function sendSubscriptionCancelledEmail(to: string): Promise<void> {
  const locale = await resolveLanguageFromEmail(to);
  const { subject, html: body } = getTemplate('subscriptionCancelled', locale)({});
  await sendRaw(to, subject, layout(body));
}

// ─── 10. Generic notification email (called from notify.ts) ────────────────

// Map in-app notif type → gated EmailType (skip when not mapped → transactional layout)
const NOTIF_EMAIL_TYPE: Record<string, EmailType> = {
  approval_needed:  'approval_needed',
  published:        'post_published',
  failed:           'post_failed',
  comment:          'comment_pending',
  ticket_reply:     'ticket_reply',
  chat_message:     'chat_message',
  recreation_ready: 'recreation_ready',
  limit_reached:    'limit_reached',
  token_expired:    'token_expired',
  payment_failed:   'payment_failed',
};

export async function sendNotificationEmail(opts: {
  to:        string;
  brandName: string;
  type:      string;
  message:   string;
  metadata?: Record<string, unknown>;
  brandId?:  string;
}): Promise<void> {
  const emailType = NOTIF_EMAIL_TYPE[opts.type];

  // Gated path — we have a brandId + known mapping and it's not transactional.
  if (opts.brandId && emailType && !TRANSACTIONAL_TYPES.has(opts.type)) {
    await sendGated({
      brandId:  opts.brandId,
      type:     emailType,
      template: 'genericNotification',
      props:    { brandName: opts.brandName, type: opts.type, message: opts.message },
      to:       opts.to,
    });
    return;
  }

  // Transactional fallback — no unsubscribe footer
  const locale = await resolveLanguageFromEmail(opts.to);
  const { subject, html: body } = getTemplate('genericNotification', locale)({
    brandName: opts.brandName, type: opts.type, message: opts.message,
  });
  await sendRaw(opts.to, subject, layout(body));
}

// ─── 11. Reactivation (gated: reactivation) ────────────────────────────────

/**
 * Sends a reactivation email for a given segment (7, 14 or 30 days of
 * inactivity). Returns true when sent, false when blocked (opt-out,
 * anti-spam window, no recipient). Marks the brand's
 * `last_reactivation_email_at` on success.
 */
export async function sendReactivationEmail(params: {
  brandId: string;
  segment: 7 | 14 | 30;
  isPaid:  boolean;
  /** Override recipient (rare — usually resolved from the brand). */
  to?:     string;
}): Promise<boolean> {
  return sendGated({
    brandId:  params.brandId,
    type:     'reactivation',
    template: 'reactivation',
    props: {
      // brandName resolved inside sendGated's canSendEmail → gate.brandName
      // but the template already ignores brandName when missing; we pass
      // a safe default.
      brandName: '', // filled below via a small trick
      segment:   params.segment,
      isPaid:    params.isPaid,
    },
    to: params.to,
  });
}

// ─── Re-exports ────────────────────────────────────────────────────────────

export { canSendEmail, markEmailSent, TRANSACTIONAL_TYPES } from './email/preferences';
export type { EmailType } from './email/preferences';
