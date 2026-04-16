import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { getStripeClient, getPriceId } from '@/lib/stripe';
import { requirePermission } from '@/lib/rbac';
import type { SubscriptionPlan } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function POST(request: Request) {
  try {
    const user     = await requireServerUser();
    const body     = await request.json() as { plan: SubscriptionPlan; promoCodeId?: string };
    const supabase = await createServerClient() as DB;
    const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    // Get brand
    const { data: brand } = await supabase
      .from('brands')
      .select('id,stripe_customer_id,name')
      .eq('user_id', user.id)
      .single();

    const permErr = await requirePermission(user.id, brand?.id, 'manage_billing');
    if (permErr) return permErr;

    const stripe = getStripeClient();
    let customerId: string | undefined = brand?.stripe_customer_id ?? undefined;

    // Create Stripe customer if one doesn't exist yet
    if (!customerId) {
      const { data: authUser } = await supabase.auth.getUser();
      const email = authUser?.user?.email ?? '';

      const customer = await stripe.customers.create({
        email,
        name:     brand?.name ?? undefined,
        metadata: { brand_id: brand?.id ?? '', user_id: user.id },
      });

      customerId = customer.id;

      // Save immediately so concurrent requests don't create duplicates
      await supabase
        .from('brands')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', user.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode:                 'subscription',
      customer:             customerId,
      client_reference_id:  user.id,
      line_items:           [{ price: getPriceId(body.plan), quantity: 1 }],
      success_url:          `${appUrl}/settings/plan?success=true`,
      cancel_url:           `${appUrl}/settings/plan?cancelled=true`,
      locale:               'es',
      ...(body.promoCodeId
        ? { discounts: [{ promotion_code: body.promoCodeId }] }
        : { allow_promotion_codes: true }),
      subscription_data: {
        trial_period_days: 14,
        metadata: { brand_id: brand?.id ?? '', user_id: user.id },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return apiError(err, 'stripe/checkout');
  }
}
