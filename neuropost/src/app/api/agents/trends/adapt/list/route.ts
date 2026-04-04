import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const user = await requireServerUser();
    const sp   = new URL(request.url).searchParams;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createServerClient() as any;

    const { data: brand } = await supabase.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { data: brandTrends } = await supabase
      .from('brand_trends')
      .select('*, trends(*)')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false })
      .limit(sp.get('latest') ? 1 : 50);

    return NextResponse.json({ brandTrends: brandTrends ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
