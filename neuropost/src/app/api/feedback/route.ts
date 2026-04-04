import { NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const supabase = await createRouteClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json() as { rating?: number; message?: string; page?: string };
    const { rating, message, page } = body;

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating inválido' }, { status: 400 });
    }

    // Get user's brand if available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: brand } = await (supabase as any)
      .from('brands')
      .select('id')
      .eq('user_id', user.id)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: dbError } = await (supabase as any).from('feedback').insert({
      rating,
      message: message ?? null,
      page: page ?? null,
      user_id: user.id,
      brand_id: brand?.id ?? null,
    });

    if (dbError) throw dbError;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[feedback]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
