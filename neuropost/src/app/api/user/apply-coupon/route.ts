import { createServerClient } from '@/lib/supabase';
import { requireServerUser } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const user = await requireServerUser();
    const supabase = await createServerClient();

    const body = await req.json();
    const { promoCodeId, brandId, periodType } = body;

    if (!promoCodeId || !brandId || !periodType) {
      return NextResponse.json(
        { error: 'Parámetros requeridos' },
        { status: 400 }
      );
    }

    // Verificar que el usuario sea propietario de la marca
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, owner_id')
      .eq('id', brandId)
      .single();

    if (brandError || !brand || brand.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      );
    }

    // Incrementar used_count
    const { data: promoCode, error: promoError } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('id', promoCodeId)
      .single();

    if (promoError || !promoCode) {
      return NextResponse.json(
        { error: 'Cupón no encontrado' },
        { status: 404 }
      );
    }

    // Actualizar used_count
    const { error: updateError } = await supabase
      .from('promo_codes')
      .update({ used_count: promoCode.used_count + 1 })
      .eq('id', promoCodeId);

    if (updateError) throw updateError;

    // Registrar aplicación del cupón
    const { error: insertError } = await supabase.from('coupon_applications').insert({
      promo_code_id: promoCodeId,
      user_id: user.id,
      brand_id: brandId,
      discount_amount:
        promoCode.discount_type === 'percentage'
          ? null
          : promoCode.discount_value,
      period_type: periodType,
    });

    if (insertError) throw insertError;

    return NextResponse.json({
      success: true,
      message:
        periodType === 'next_billing'
          ? 'Cupón aplicado. Se descontará en la próxima renovación'
          : 'Cupón aplicado. Se descontará inmediatamente',
    });
  } catch (error) {
    console.error('Error applying coupon:', error);
    return NextResponse.json(
      { error: 'Error applying coupon' },
      { status: 500 }
    );
  }
}
