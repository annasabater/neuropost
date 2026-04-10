import { createServerClient, createAdminClient } from '@/lib/supabase';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { NextRequest, NextResponse } from 'next/server';

// Generar código único
function generatePromoCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function GET(req: NextRequest) {
  try {
    const worker = await requireWorker();
    const supabase = await createServerClient();

    const searchParams = req.nextUrl.searchParams;
    const filter = searchParams.get('filter'); // 'active' | 'expired' | 'all'

    let query = supabase.from('promo_codes').select('*').order('created_at', { ascending: false });

    if (filter === 'active') {
      const now = new Date().toISOString();
      query = query.eq('is_active', true).lte('valid_from', now).gt('valid_until', now);
    } else if (filter === 'expired') {
      const now = new Date().toISOString();
      query = query.or(`is_active.eq.false,valid_until.lte.${now}`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ promoCodes: data });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const worker = await requireWorker();
    const supabase = await createServerClient();

    const body = await req.json();
    const {
      code: customCode,
      discountType,
      discountValue,
      applicablePlans,
      validFrom,
      validUntil,
      maxUses,
    } = body;

    // Validaciones
    if (!discountType || !discountValue || discountValue <= 0) {
      return NextResponse.json(
        { error: 'Tipo y valor de descuento requeridos' },
        { status: 400 }
      );
    }

    if (new Date(validFrom) >= new Date(validUntil)) {
      return NextResponse.json(
        { error: 'La fecha de inicio debe ser anterior a la de fin' },
        { status: 400 }
      );
    }

    const code = customCode || generatePromoCode();

    // Verificar que el código sea único
    const { data: existing } = await supabase
      .from('promo_codes')
      .select('id')
      .eq('code', code)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Este código ya existe' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.from('promo_codes').insert({
      code,
      discount_type: discountType,
      discount_value: discountValue,
      applicable_plans: applicablePlans || null,
      valid_from: validFrom,
      valid_until: validUntil,
      max_uses: maxUses || null,
      used_count: 0,
      is_active: true,
      created_by_worker_id: worker.id,
    }).select().single();

    if (error) throw error;

    return NextResponse.json({ promoCode: data });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const worker = await requireWorker();
    const supabase = await createServerClient();

    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('promo_codes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ promoCode: data });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const worker = await requireWorker();
    const supabase = await createServerClient();

    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    const { error } = await supabase.from('promo_codes').delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
