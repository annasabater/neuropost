import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { checkFeature } from '@/lib/plan-limits';

export async function POST(request: Request) {
  try {
    const user = await requireServerUser();
    const { brandTrendId } = await request.json() as { brandTrendId: string };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createServerClient() as any;

    const { data: brand }      = await supabase.from('brands').select('id,plan').eq('user_id', user.id).single();
    const { data: brandTrend } = await supabase.from('brand_trends').select('*').eq('id', brandTrendId).single();

    if (!brand || !brandTrend) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (brandTrend.brand_id !== brand.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Plan gate — trends agent is a Total+ feature.
    const gate = await checkFeature(brand.id, 'trendsAgent');
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.reason, upgradeUrl: gate.upgradeUrl }, { status: 402 });
    }

    // Create a post from the trend
    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        brand_id:  brand.id,
        caption:   brandTrend.adapted_caption,
        hashtags:  brandTrend.adapted_hashtags ?? [],
        status:    'draft',
        goal:      'engagement',
        metadata:  { source: 'trend', brand_trend_id: brandTrendId },
      })
      .select()
      .single();

    if (error) throw error;

    // Mark trend as used
    await supabase.from('brand_trends').update({ status: 'used', post_id: post.id }).eq('id', brandTrendId);

    return NextResponse.json({ post });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireServerUser();
    const { brandTrendId, status } = await request.json() as { brandTrendId: string; status: string };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createServerClient() as any;
    const { data: brand } = await supabase.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    await supabase.from('brand_trends').update({ status }).eq('id', brandTrendId).eq('brand_id', brand.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
