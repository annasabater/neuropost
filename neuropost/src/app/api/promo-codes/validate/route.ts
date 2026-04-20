import { createServerClient } from '@/lib/supabase';
import { requireServerUser } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const user = await requireServerUser();
    const supabase = await createServerClient();

    const body = await req.json();
    const { code, planId } = body;

    if (!code || !planId) {
      return NextResponse.json(
        { error: 'Código y plan requeridos' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Buscar el cupón
    const { data: promoCode, error: fetchError } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();

    if (fetchError || !promoCode) {
      return NextResponse.json(
        { error: 'Cupón no válido' },
        { status: 404 }
      );
    }

    // Validaciones
    if (!promoCode.is_active) {
      return NextResponse.json({ error: 'Cupón inactivo' }, { status: 400 });
    }

    if (new Date(promoCode.valid_from) > new Date(now)) {
      return NextResponse.json({ error: 'Cupón aún no válido' }, { status: 400 });
    }

    if (new Date(promoCode.valid_until) < new Date(now)) {
      return NextResponse.json({ error: 'Cupón expirado' }, { status: 400 });
    }

    if (promoCode.max_uses && promoCode.used_count >= promoCode.max_uses) {
      return NextResponse.json({ error: 'Cupón agotado' }, { status: 400 });
    }

    // Verificar que el plan sea aplicable
    if (promoCode.applicable_plans && !promoCode.applicable_plans.includes(planId)) {
      return NextResponse.json(
        { error: `Este cupón no aplica al plan ${planId}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      promoCode: {
        id: promoCode.id,
        code: promoCode.code,
        discountType: promoCode.discount_type,
        discountValue: promoCode.discount_value,
        applicablePlans: promoCode.applicable_plans,
      },
    });
  } catch (error) {
    console.error('Error validating coupon:', error);
    return NextResponse.json({ error: 'Error validating coupon' }, { status: 500 });
  }
}
