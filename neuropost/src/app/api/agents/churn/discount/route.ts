import { NextResponse } from 'next/server';
import { rateLimitAgents } from '@/lib/ratelimit';
import { apiError } from '@/lib/api-utils';
import { requireSuperAdmin, adminErrorResponse } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase';
import Stripe from 'stripe';

export async function POST(request: Request) {
  try {
    const rl = await rateLimitAgents(request);
    if (rl) return rl;
    await requireSuperAdmin();
    const { brandId, percentOff = 50 } = await request.json() as { brandId: string; percentOff?: number };

    const db     = createAdminClient();
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2026-03-25.dahlia' as never });

    const { data: brand } = await db.from('brands').select('name,stripe_customer_id').eq('id', brandId).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const coupon = await stripe.coupons.create({
      percent_off: percentOff,
      duration:    'once',
      name:        `Retención NeuroPost — ${percentOff}% descuento 1 mes`,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const promo = await (stripe.promotionCodes as any).create({
      coupon:          coupon.id,
      max_redemptions: 1,
    });

    // Save action
    await db.from('churn_actions').insert({
      brand_id:             brandId,
      action_type:          'discount_offered',
      churn_score_at_action: 0,
      discount_code:        promo.code,
    });

    return NextResponse.json({ code: promo.code, percentOff, couponId: coupon.id });
  } catch (err) {
    const { error, status } = adminErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
