import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { getStripeClient } from '@/lib/stripe';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function POST(request: Request) {
  try {
    const user = await requireServerUser();
    const { code } = await request.json() as { code: string };

    const supabase = await createServerClient() as DB;

    const { data: brand } = await supabase
      .from('brands')
      .select('id, stripe_subscription_id, stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    if (!brand || !brand.stripe_subscription_id) {
      return NextResponse.json({ error: 'No tienes una suscripción activa' }, { status: 400 });
    }

    const stripe = getStripeClient();
    const normalizedCode = (code ?? '').trim().toUpperCase();

    const promoCodes = await stripe.promotionCodes.list({
      code: normalizedCode,
      active: true,
      limit: 1,
      expand: ['data.coupon'],
    });

    if (!promoCodes.data.length) {
      return NextResponse.json({ success: false, error: 'Código no válido o expirado' });
    }

    const promoCode = promoCodes.data[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coupon = (promoCode as any).coupon;

    // Apply discount to existing subscription
    await stripe.subscriptions.update(brand.stripe_subscription_id, {
      discounts: [{ promotion_code: promoCode.id }],
    });

    // Build savings text
    let savingsText = '';
    if (coupon.percent_off != null) {
      savingsText = `${coupon.percent_off}% de descuento`;
    } else if (coupon.amount_off != null) {
      savingsText = `${(coupon.amount_off / 100).toFixed(2).replace('.', ',')}€ de descuento`;
    }

    // Log activity
    await supabase.from('activity_log').insert({
      brand_id: brand.id,
      user_id: user.id,
      action: 'coupon_applied',
      details: {
        code: normalizedCode,
        discount: savingsText,
        couponId: coupon.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: `¡Código aplicado! ${savingsText} en tu próxima factura.`,
      savingsText,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripeCode = (err as any)?.code;
    if (stripeCode === 'coupon_already_applied') {
      return NextResponse.json({ success: false, error: 'Este código ya está aplicado a tu cuenta' });
    }
    return apiError(err, 'stripe/apply-coupon');
  }
}
