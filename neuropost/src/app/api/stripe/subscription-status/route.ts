import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { getStripeClient } from '@/lib/stripe';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function GET() {
  try {
    const user = await requireServerUser();
    const supabase = await createServerClient() as DB;

    const { data: brand } = await supabase
      .from('brands')
      .select('id, stripe_subscription_id, stripe_customer_id, plan, trial_ends_at')
      .eq('user_id', user.id)
      .single();

    if (!brand?.stripe_subscription_id) {
      return NextResponse.json({
        plan: brand?.plan ?? null,
        status: 'free',
        discount: null,
      });
    }

    const stripe = getStripeClient();

    const subscription = await stripe.subscriptions.retrieve(
      brand.stripe_subscription_id,
      { expand: ['discount.coupon', 'discount.promotion_code'] },
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const disc = (subscription as any).discount;
    let discount = null;

    if (disc) {
      discount = {
        code: disc.promotion_code?.code ?? null,
        percentOff: disc.coupon?.percent_off ?? null,
        amountOff: disc.coupon?.amount_off ? disc.coupon.amount_off / 100 : null,
        endsAt: disc.end ?? null,
        duration: disc.coupon?.duration ?? null,
        durationInMonths: disc.coupon?.duration_in_months ?? null,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub = subscription as any;
    return NextResponse.json({
      plan: brand.plan,
      status: sub.status,
      currentPeriodEnd: sub.current_period_end,
      trialEnd: sub.trial_end,
      discount,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return apiError(err, 'stripe/subscription-status');
  }
}
