import { NextResponse } from 'next/server';
import { requireSuperAdmin, adminErrorResponse } from '@/lib/admin';
import { getStripeClient } from '@/lib/stripe';

interface CreateCouponBody {
  code:              string;
  percentOff?:       number;
  amountOff?:        number;
  currency?:         string;
  duration:          'once' | 'repeating' | 'forever';
  durationInMonths?: number;
  maxRedemptions?:   number;
  expiresAt?:        number;
}

export async function GET() {
  try {
    await requireSuperAdmin();

    const stripe = getStripeClient();

    const promotionCodes = await stripe.promotionCodes.list({
      active: true,
      limit: 50,
      expand: ['data.coupon'],
    });

    return NextResponse.json({ promotionCodes: promotionCodes.data });
  } catch (err) {
    const { error, status } = adminErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSuperAdmin();
    const body = await request.json() as CreateCouponBody;

    const stripe = getStripeClient();

    const coupon = await stripe.coupons.create({
      ...(body.percentOff != null
        ? { percent_off: body.percentOff }
        : { amount_off: Math.round((body.amountOff ?? 0) * 100), currency: body.currency ?? 'eur' }),
      duration: body.duration,
      ...(body.duration === 'repeating' ? { duration_in_months: body.durationInMonths } : {}),
      ...(body.maxRedemptions ? { max_redemptions: body.maxRedemptions } : {}),
      name: `NeuroPost ${body.code.toUpperCase()}`,
      metadata: { created_by: user.id },
    });

    const promoCode = await stripe.promotionCodes.create({
      promotion: { type: 'coupon', coupon: coupon.id },
      code: body.code.toUpperCase(),
      ...(body.maxRedemptions ? { max_redemptions: body.maxRedemptions } : {}),
      ...(body.expiresAt ? { expires_at: body.expiresAt } : {}),
    });

    return NextResponse.json({ coupon, promoCode }, { status: 201 });
  } catch (err) {
    const { error, status } = adminErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireSuperAdmin();

    const { searchParams } = new URL(request.url);
    const promoCodeId = searchParams.get('promoCodeId');

    if (!promoCodeId) {
      return NextResponse.json({ error: 'promoCodeId is required' }, { status: 400 });
    }

    const stripe = getStripeClient();

    await stripe.promotionCodes.update(promoCodeId, { active: false });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const { error, status } = adminErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
