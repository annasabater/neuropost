// =============================================================================
// GET/PATCH /api/settings/notifications — notification preferences
// =============================================================================

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

const DEFAULTS = {
  post_ready_email:     true,
  post_published_email: true,
  comment_email:        false,
  ticket_reply_email:   true,
  weekly_report_email:  true,
  plan_alert_email:     true,
  marketing_email:      false,
  digest_enabled:       false,
  digest_hour:          9,
  timezone:             'Europe/Madrid',
};

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

    return NextResponse.json({ preferences: prefs ?? { brand_id: brand.id, ...DEFAULTS } });
  } catch (err) {
    return apiError(err, 'GET /api/settings/notifications');
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireServerUser();
    const db = createAdminClient() as DB;
    const body = await request.json();

    const { data: brand } = await db.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    // Whitelist allowed fields
    const allowed: Record<string, unknown> = {};
    const keys = Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[];
    for (const key of keys) {
      if (key in body) allowed[key] = body[key];
    }
    allowed.updated_at = new Date().toISOString();

    // Upsert: create or update
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
