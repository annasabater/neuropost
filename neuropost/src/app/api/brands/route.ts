import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { queueJob } from '@/lib/agents/queue';
import type { Brand } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function GET() {
  try {
    const user     = await requireServerUser();
    const supabase = await createServerClient() as DB;
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .eq('user_id', user.id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return NextResponse.json({ brand: (data as Brand | null) ?? null });
  } catch (err) {
    return apiError(err, 'brands');
  }
}

export async function POST(request: Request) {
  try {
    const user     = await requireServerUser();
    const body     = await request.json();
    const supabase = await createServerClient() as DB;

    // Remove fields that don't exist as columns in the brands table
    const { publish_frequency: _pf, promo_code_id: _pc, content_categories: incomingCategories, ...brandFields } = body;

    // Guard against duplicate brands per user
    const { data: existing } = await supabase
      .from('brands').select('id').eq('user_id', user.id).maybeSingle();
    if (existing) return NextResponse.json({ brand: existing }, { status: 200 });

    const { data, error } = await supabase
      .from('brands')
      .insert({ ...brandFields, user_id: user.id, plan: 'starter' })
      .select()
      .single();
    if (error) {
      console.error('[POST /api/brands] Supabase error:', JSON.stringify(error));
      return NextResponse.json({ error: error.message ?? error.details ?? JSON.stringify(error) }, { status: 500 });
    }

    // Seed content_categories if provided by onboarding
    if (Array.isArray(incomingCategories) && incomingCategories.length > 0 && data?.id) {
      const rows = (incomingCategories as { category_key: string; name: string; source: string; active: boolean }[])
        .map((c) => ({ brand_id: data.id, category_key: c.category_key, name: c.name, source: c.source ?? 'template', active: c.active ?? true }));
      await supabase.from('content_categories').insert(rows).then(() => void 0);
    }

    // Fire holiday detection agent for the current + next year (fire-and-forget)
    if (data?.id) {
      const currentYear = new Date().getFullYear();
      for (const yr of [currentYear, currentYear + 1]) {
        queueJob({
          brand_id: data.id,
          agent_type: 'scheduling',
          action: 'detect_holidays',
          input: { year: yr },
          priority: 40,
          requested_by: 'cron',
        }).catch(() => null);
      }
    }

    return NextResponse.json({ brand: data as Brand }, { status: 201 });
  } catch (err: unknown) {
    console.error('[POST /api/brands] CATCH:', JSON.stringify(err, Object.getOwnPropertyNames(err as object)));
    const message = err instanceof Error ? err.message
      : (typeof err === 'object' && err !== null && 'message' in err) ? String((err as Record<string, unknown>).message)
      : JSON.stringify(err);
    return apiError(err, 'brands');
  }
}

export async function PATCH(request: Request) {
  try {
    const user     = await requireServerUser();
    const body     = await request.json() as Record<string, unknown>;
    const supabase = await createServerClient() as DB;

    // Remove privileged fields that must not be updated via this endpoint
    const {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      plan: _plan,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      stripe_customer_id: _stripe_customer_id,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      stripe_subscription_id: _stripe_subscription_id,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      user_id: _user_id,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      id: _id,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      created_at: _created_at,
      ...allowedFields
    } = body;

    // Fetch current location before updating to detect changes
    const { data: current } = await supabase
      .from('brands')
      .select('id, location')
      .eq('user_id', user.id)
      .single();

    const { data, error } = await supabase
      .from('brands')
      .update(allowedFields)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) throw error;

    // Re-trigger holiday agent when location changes
    const locationChanged = 'location' in allowedFields && allowedFields.location !== current?.location;
    if (locationChanged && data?.id) {
      const currentYear = new Date().getFullYear();
      for (const yr of [currentYear, currentYear + 1]) {
        queueJob({
          brand_id: data.id,
          agent_type: 'scheduling',
          action: 'detect_holidays',
          input: { year: yr, force_refresh: true },
          priority: 55,
          requested_by: 'system',
        }).catch(() => null);
      }
    }

    return NextResponse.json({ brand: data as Brand });
  } catch (err) {
    return apiError(err, 'brands');
  }
}
