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

    // Guard against duplicate brands per user
    const { data: existing } = await supabase
      .from('brands').select('id').eq('user_id', user.id).maybeSingle();
    if (existing) return NextResponse.json({ brand: existing }, { status: 200 });

    const { data, error } = await supabase
      .from('brands')
      .insert({ ...body, user_id: user.id, plan: 'starter' })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ brand: data as Brand }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
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
