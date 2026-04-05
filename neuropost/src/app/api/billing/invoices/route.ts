import { NextResponse } from 'next/server';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    const user = await requireServerUser();
    const db = createAdminClient();

    const { data: brand } = await db.from('brands').select('stripe_customer_id').eq('user_id', user.id).single();
    if (!brand?.stripe_customer_id) return NextResponse.json({ invoices: [] });

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' as never });

    const invoices = await stripe.invoices.list({
      customer: brand.stripe_customer_id,
      limit: 24,
    });

    const items = invoices.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      amount: inv.amount_paid / 100,
      currency: inv.currency,
      status: inv.status,
      period_start: inv.period_start,
      period_end: inv.period_end,
      pdf_url: inv.invoice_pdf,
      created: inv.created,
    }));

    return NextResponse.json({ invoices: items });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
