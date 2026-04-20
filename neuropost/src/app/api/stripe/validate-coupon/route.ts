import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { getStripeClient } from '@/lib/stripe';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = (searchParams.get('code') ?? '').trim().toUpperCase();

    if (!code) {
      return NextResponse.json({ valid: false, error: 'Código no válido o expirado' });
    }

    const stripe = getStripeClient();

    const promoCodes = await stripe.promotionCodes.list({
      code,
      active: true,
      limit: 1,
      expand: ['data.coupon'],
    });

    if (!promoCodes.data.length) {
      return NextResponse.json({ valid: false, error: 'Código no válido o expirado' });
    }

    const promoCode = promoCodes.data[0];

    // Check expiry
    if (promoCode.expires_at && promoCode.expires_at < Math.floor(Date.now() / 1000)) {
      return NextResponse.json({ valid: false, error: 'Este código ha caducado' });
    }

    // Check redemption limit
    if (
      promoCode.max_redemptions != null &&
      promoCode.times_redeemed >= promoCode.max_redemptions
    ) {
      return NextResponse.json({ valid: false, error: 'Este código ha alcanzado su límite de usos' });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coupon = (promoCode as any).coupon;

    // Build discount text
    let discountText = '';
    if (coupon.percent_off != null) {
      discountText = `${coupon.percent_off}% de descuento`;
    } else if (coupon.amount_off != null) {
      discountText = `${(coupon.amount_off / 100).toFixed(2).replace('.', ',')}€ de descuento`;
    }

    // Build duration text
    let durationText = '';
    if (coupon.duration === 'once') {
      durationText = 'en tu primer mes';
    } else if (coupon.duration === 'repeating') {
      durationText = `durante ${coupon.duration_in_months} meses`;
    } else {
      durationText = 'para siempre';
    }

    return NextResponse.json({
      valid: true,
      promoCodeId: promoCode.id,
      discountText: `${discountText} ${durationText}`.trim(),
      percentOff: coupon.percent_off ?? null,
      amountOff: coupon.amount_off ? coupon.amount_off / 100 : null,
      duration: coupon.duration,
      durationInMonths: coupon.duration_in_months ?? null,
    });
  } catch (err) {
    return apiError(err, 'stripe/validate-coupon');
  }
}
