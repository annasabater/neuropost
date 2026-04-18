// =============================================================================
// NEUROPOST — Email preference gating
// Single source of truth for "is this brand allowed to receive email of type X?"
// Every emitter must call canSendEmail() before sending and markEmailSent()
// after a successful send.
// =============================================================================

import { createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

// ─── Types ──────────────────────────────────────────────────────────────────

/** Gated email types (user can opt-out). */
export type EmailType =
  | 'approval_needed'
  | 'ticket_reply'
  | 'chat_message'
  | 'recreation_ready'
  | 'comment_pending'
  | 'token_expired'
  | 'post_published'
  | 'post_failed'
  | 'payment_failed'
  | 'trial_ending'
  | 'limit_reached'
  | 'reactivation'
  | 'no_content'
  | 'onboarding_incomplete'
  | 'no_social_connected'
  | 'plan_unused'
  | 'weekly_report'
  | 'monthly_report'
  | 'daily_digest'
  | 'marketing'
  | 'product_updates'
  | 'newsletter';

/** Transactional types — never gated, never opt-outable. */
export const TRANSACTIONAL_TYPES = new Set<string>([
  'welcome',
  'password_reset',
  'plan_activated',
  'subscription_cancelled',
  'team_invite',
  'urgent_ticket',
  'security_alert',
  // Always delivered — user cannot disable (UI toggle removed).
  'payment_failed',
  'limit_reached',
  'plan_unused',
  'no_social_connected',
  'onboarding_incomplete',
  'no_content',
]);

export type SupportedLanguage = 'es' | 'en' | 'fr' | 'pt';
const LOCALES: readonly SupportedLanguage[] = ['es', 'en', 'fr', 'pt'];

export function normalizeLocale(input: string | null | undefined): SupportedLanguage {
  if (!input) return 'es';
  const lower = input.toLowerCase().slice(0, 2);
  return LOCALES.includes(lower as SupportedLanguage) ? (lower as SupportedLanguage) : 'es';
}

export interface CanSendResult {
  allowed:  boolean;
  /** Reason the email was blocked (for logs). undefined when allowed=true. */
  reason?:  string;
  /** Resolved recipient language — always returned even when blocked. */
  language: SupportedLanguage;
  /** Resolved max_frequency — 'immediate' | 'daily' | 'weekly'. */
  frequency: 'immediate' | 'daily' | 'weekly';
  /** The brand's primary user email (if we could resolve it). */
  email?:   string;
  brandName?: string;
}

// ─── Anti-spam windows (min days between emails of each type) ───────────────

const ANTI_SPAM_DAYS: Partial<Record<EmailType, number>> = {
  reactivation:          14,
  no_content:            14,
  onboarding_incomplete: 30,
  no_social_connected:   30,
  plan_unused:           30,
};

/** brands.* column name that stores the last-sent timestamp for this type. */
const LAST_SENT_COLUMN: Partial<Record<EmailType, string>> = {
  reactivation:          'last_reactivation_email_at',
  no_content:            'last_no_content_email_at',
  onboarding_incomplete: 'last_onboarding_email_at',
  no_social_connected:   'last_no_social_email_at',
  plan_unused:           'last_plan_unused_email_at',
};

/** notification_preferences column name for each gated type. */
const PREF_COLUMN: Record<EmailType, string> = {
  approval_needed:       'approval_needed_email',
  ticket_reply:          'ticket_reply_email',
  chat_message:          'chat_message_email',
  recreation_ready:      'recreation_ready_email',
  comment_pending:       'comment_pending_email',
  token_expired:         'token_expired_email',
  post_published:        'post_published_email',
  post_failed:           'post_failed_email',
  payment_failed:        'payment_failed_email',
  trial_ending:          'trial_ending_email',
  limit_reached:         'limit_reached_email',
  reactivation:          'reactivation_email',
  no_content:            'no_content_email',
  onboarding_incomplete: 'onboarding_incomplete_email',
  no_social_connected:   'no_social_connected_email',
  plan_unused:           'plan_unused_email',
  weekly_report:         'weekly_report_email',
  monthly_report:        'monthly_report_email',
  daily_digest:          'daily_digest_email',
  marketing:             'marketing_email',
  product_updates:       'product_updates_email',
  newsletter:            'newsletter_email',
};

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Check if we're allowed to send an email of the given type to the given brand.
 * Also resolves the recipient's email, name, preferred language and frequency.
 */
export async function canSendEmail(
  brandId: string,
  type: EmailType | string,
): Promise<CanSendResult> {
  const db = createAdminClient() as DB;

  // Always resolve recipient basics so callers can keep going even with skip
  const { data: brand } = await db
    .from('brands')
    .select(
      'id, name, user_id, marketing_consent, ' +
      'last_reactivation_email_at, last_no_content_email_at, ' +
      'last_onboarding_email_at, last_no_social_email_at, last_plan_unused_email_at',
    )
    .eq('id', brandId)
    .maybeSingle();

  if (!brand) {
    return { allowed: false, reason: 'brand_not_found', language: 'es', frequency: 'immediate' };
  }

  // Resolve primary user email
  let email: string | undefined;
  try {
    const { data: u } = await db.auth.admin.getUserById(brand.user_id);
    email = u?.user?.email ?? undefined;
  } catch { /* noop */ }

  // Resolve language from preferences → profile → default 'es'
  const { data: prefs } = await db
    .from('notification_preferences')
    .select('*')
    .eq('brand_id', brandId)
    .maybeSingle();

  let language: SupportedLanguage = 'es';
  let frequency: 'immediate' | 'daily' | 'weekly' = 'immediate';
  if (prefs) {
    if (prefs.email_language) language = normalizeLocale(prefs.email_language);
    if (prefs.max_frequency === 'daily' || prefs.max_frequency === 'weekly') {
      frequency = prefs.max_frequency;
    }
  }
  if (language === 'es' && !prefs?.email_language) {
    const { data: profile } = await db
      .from('profiles').select('language').eq('id', brand.user_id).maybeSingle();
    if (profile?.language) language = normalizeLocale(profile.language);
  }

  const baseResult = { language, frequency, email, brandName: brand.name ?? undefined };

  // Transactional → always allowed
  if (TRANSACTIONAL_TYPES.has(type)) {
    return { allowed: true, ...baseResult };
  }

  // Unknown type → block to fail-safe
  const prefColumn = PREF_COLUMN[type as EmailType];
  if (!prefColumn) {
    return { allowed: false, reason: `unknown_type:${type}`, ...baseResult };
  }

  // GDPR — marketing-family types require explicit consent
  if (type === 'marketing' || type === 'newsletter' || type === 'product_updates') {
    if (!brand.marketing_consent) {
      return { allowed: false, reason: 'no_marketing_consent', ...baseResult };
    }
  }

  // Preference toggle — default true when no row exists (matches existing /api
  // default behaviour), but marketing types default to false at table level.
  const toggleValue = prefs ? (prefs as Record<string, unknown>)[prefColumn] : true;
  if (toggleValue === false) {
    return { allowed: false, reason: 'user_opted_out', ...baseResult };
  }

  // Anti-spam window (only for reminder-family types)
  const minDays = ANTI_SPAM_DAYS[type as EmailType];
  const lastCol = LAST_SENT_COLUMN[type as EmailType];
  if (minDays && lastCol) {
    const lastAt = brand[lastCol as keyof typeof brand] as string | null | undefined;
    if (lastAt) {
      const ageMs = Date.now() - new Date(lastAt).getTime();
      if (ageMs < minDays * 24 * 60 * 60 * 1000) {
        return { allowed: false, reason: `anti_spam_${minDays}d`, ...baseResult };
      }
    }
  }

  return { allowed: true, ...baseResult };
}

/**
 * Called after a successful email send. Updates brands.last_{type}_email_at
 * when the type has an anti-spam window, and always logs to activity_log.
 */
export async function markEmailSent(
  brandId: string,
  type: EmailType | string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const db = createAdminClient() as DB;

  const lastCol = LAST_SENT_COLUMN[type as EmailType];
  if (lastCol) {
    try {
      await db.from('brands').update({ [lastCol]: new Date().toISOString() }).eq('id', brandId);
    } catch (err) {
      console.warn('[markEmailSent] brand update failed:', err);
    }
  }

  try {
    await db.from('activity_log').insert({
      brand_id:    brandId,
      action:      `email_sent_${type}`,
      entity_type: 'email',
      details:     metadata,
    });
  } catch (err) {
    console.warn('[markEmailSent] activity_log insert failed:', err);
  }
}
