// =============================================================================
// NEUROPOST — Email unsubscribe tokens
// Every notification email we send carries a footer with a one-click
// unsubscribe link. The link points at /unsubscribe?token=<uuid>&type=<type>
// where <uuid> is a row in email_unsubscribe_tokens keyed by brand_id.
// =============================================================================

import { createAdminClient } from '@/lib/supabase';
import type { EmailType } from './preferences';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

const APP = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://neuropost.app';

/**
 * Returns the (single, stable) unsubscribe token for a brand, creating it on
 * first request. We keep one token per brand so links stay stable across
 * emails.
 */
export async function getOrCreateUnsubscribeToken(brandId: string): Promise<string> {
  const db = createAdminClient() as DB;

  const { data: existing } = await db
    .from('email_unsubscribe_tokens')
    .select('token')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing?.token) return existing.token as string;

  const { data: created, error } = await db
    .from('email_unsubscribe_tokens')
    .insert({ brand_id: brandId })
    .select('token')
    .single();
  if (error || !created?.token) {
    throw new Error(`Failed to create unsubscribe token: ${error?.message ?? 'unknown'}`);
  }
  return created.token as string;
}

/** Build the full unsubscribe URL for a brand + email type. */
export async function getUnsubscribeUrl(brandId: string, type: EmailType | string): Promise<string> {
  const token = await getOrCreateUnsubscribeToken(brandId);
  return `${APP()}/unsubscribe?token=${token}&type=${encodeURIComponent(type)}`;
}

/** Manage-preferences deep link. */
export function getPreferencesUrl(): string {
  return `${APP()}/settings?tab=notificaciones`;
}

/** HTML block appended to every gated email template. */
export async function buildEmailFooter(
  brandId: string,
  type: EmailType | string,
): Promise<string> {
  let unsubUrl: string;
  try {
    unsubUrl = await getUnsubscribeUrl(brandId, type);
  } catch {
    // If token creation fails we still render the footer but with a fallback
    // pointing at settings — never block the email over footer errors.
    unsubUrl = getPreferencesUrl();
  }
  const prefsUrl = getPreferencesUrl();
  return `
    <p style="font-size:11px;color:#999;margin-top:24px;line-height:1.7;text-align:center">
      <a href="${unsubUrl}" style="color:#999;text-decoration:underline">Darme de baja de este tipo de emails</a>
      &nbsp;·&nbsp;
      <a href="${prefsUrl}" style="color:#999;text-decoration:underline">Gestionar preferencias</a>
    </p>
  `;
}
