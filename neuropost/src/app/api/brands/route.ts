import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient } from '@/lib/supabase';
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
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user     = await requireServerUser();
    const body     = await request.json();
    const supabase = await createServerClient() as DB;

    // Remove fields that don't exist as columns in the brands table
    const { publish_frequency: _pf, promo_code_id: _pc, ...brandFields } = body;

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
    return NextResponse.json({ brand: data as Brand }, { status: 201 });
  } catch (err: unknown) {
    console.error('[POST /api/brands] CATCH:', JSON.stringify(err, Object.getOwnPropertyNames(err as object)));
    const message = err instanceof Error ? err.message
      : (typeof err === 'object' && err !== null && 'message' in err) ? String((err as Record<string, unknown>).message)
      : JSON.stringify(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
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

    const { data, error } = await supabase
      .from('brands')
      .update(allowedFields)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ brand: data as Brand });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
