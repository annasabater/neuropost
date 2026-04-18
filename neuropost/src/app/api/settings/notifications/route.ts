// =============================================================================
// GET/PATCH /api/settings/notifications — notification preferences
// =============================================================================

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

// Boolean toggles — defaults match the migration DEFAULT clauses
const BOOL_DEFAULTS: Record<string, boolean> = {
  // Legacy (kept for back-compat with existing API callers)
  post_ready_email:      true,
  post_published_email:  true,
  comment_email:         false,
  ticket_reply_email:    true,
  weekly_report_email:   true,
  plan_alert_email:      true,
  marketing_email:       false,
  digest_enabled:        false,

  // Action required
  approval_needed_email:       true,
  chat_message_email:          true,
  recreation_ready_email:      true,
  comment_pending_email:       false,

  // Technical alerts
  token_expired_email:         true,
  post_failed_email:           true,
  payment_failed_email:        true,
  trial_ending_email:          true,
  limit_reached_email:         true,

  // Reminders
  reactivation_email:          true,
  no_content_email:            true,
  onboarding_incomplete_email: true,
  no_social_connected_email:   true,
  plan_unused_email:           true,

  // Digests & reports
  monthly_report_email:        true,
  daily_digest_email:          false,

  // Marketing family (opt-in explícito)
  product_updates_email:       false,
  newsletter_email:            false,
};

const STRING_DEFAULTS: Record<string, string | null> = {
  email_language: null,
  timezone:       'Europe/Madrid',
  max_frequency:  'immediate',
};

const NUMBER_DEFAULTS: Record<string, number> = {
  digest_hour: 9,
};

const ALL_DEFAULTS = { ...BOOL_DEFAULTS, ...STRING_DEFAULTS, ...NUMBER_DEFAULTS };

const ALLOWED_FREQUENCIES = new Set(['immediate', 'daily', 'weekly']);
const ALLOWED_LANGUAGES   = new Set(['es', 'en', 'fr', 'pt']);

export async function GET() {
  try {
    const user = await requireServerUser();
    const db = createAdminClient() as DB;

    const { data: brand } = await db.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { data: prefs } = await db
      .from('notification_preferences')
      .select('*')
      .eq('brand_id', brand.id)
      .maybeSingle();

    return NextResponse.json({ preferences: prefs ?? { brand_id: brand.id, ...ALL_DEFAULTS } });
  } catch (err) {
    return apiError(err, 'GET /api/settings/notifications');
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireServerUser();
    const db = createAdminClient() as DB;
    const body = await request.json() as Record<string, unknown>;

    const { data: brand } = await db.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const allowed: Record<string, unknown> = {};

    // Boolean toggles — accept only real booleans
    for (const key of Object.keys(BOOL_DEFAULTS)) {
      if (key in body) {
        const v = body[key];
        if (typeof v === 'boolean') allowed[key] = v;
      }
    }

    // email_language — accept '', null, or one of the supported locales
    if ('email_language' in body) {
      const v = body.email_language;
      if (v === null || v === '' || (typeof v === 'string' && ALLOWED_LANGUAGES.has(v))) {
        allowed.email_language = v === '' ? null : v;
      }
    }

    // timezone — accept any non-empty string (we don't validate IANA here)
    if ('timezone' in body && typeof body.timezone === 'string' && body.timezone.trim()) {
      allowed.timezone = body.timezone.trim();
    }

    // max_frequency — strict enum
    if ('max_frequency' in body
        && typeof body.max_frequency === 'string'
        && ALLOWED_FREQUENCIES.has(body.max_frequency)) {
      allowed.max_frequency = body.max_frequency;
    }

    // digest_hour — 0..23
    if ('digest_hour' in body && typeof body.digest_hour === 'number') {
      const h = Math.floor(body.digest_hour);
      if (h >= 0 && h <= 23) allowed.digest_hour = h;
    }

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    allowed.updated_at = new Date().toISOString();

    const { data, error } = await db
      .from('notification_preferences')
      .upsert({ brand_id: brand.id, ...allowed }, { onConflict: 'brand_id' })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ preferences: data });
  } catch (err) {
    return apiError(err, 'PATCH /api/settings/notifications');
  }
}
