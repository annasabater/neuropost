import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { createPortalSession } from '@/lib/stripe';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function POST() {
  try {
    const user     = await requireServerUser();
    const supabase = await createServerClient() as DB;

    const { data: brand } = await supabase
      .from('brands').select('stripe_customer_id').eq('user_id', user.id).single();

    const customerId = brand?.stripe_customer_id as string | undefined;
    if (!customerId) return NextResponse.json({ error: 'No Stripe customer found' }, { status: 400 });

    const session = await createPortalSession(customerId);
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
