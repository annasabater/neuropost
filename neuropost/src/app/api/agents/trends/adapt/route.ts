import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { adaptTrendToBrand } from '@/agents/TrendsAgent';
import type { Brand } from '@/types';

export async function POST(request: Request) {
  try {
    const user = await requireServerUser();
    const { trendId } = await request.json() as { trendId: string };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createServerClient() as any;

    const [{ data: brand }, { data: trend }] = await Promise.all([
      supabase.from('brands').select('*').eq('user_id', user.id).single(),
      supabase.from('trends').select('*').eq('id', trendId).single(),
    ]);

    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    if (!trend) return NextResponse.json({ error: 'Trend not found' }, { status: 404 });

    const b = brand as Brand;

    // Get recent posts
    const { data: recentPosts } = await supabase
      .from('posts')
      .select('caption')
      .eq('brand_id', b.id)
      .order('created_at', { ascending: false })
      .limit(5);

    const adapted = await adaptTrendToBrand({
      trend: {
        title:       trend.title,
        format:      trend.format,
        description: trend.description,
        example:     trend.description,
        viralScore:  trend.viral_score,
        expiresIn:   trend.expires_in,
        hashtags:    trend.hashtags ?? [],
      },
      brandVoiceDoc: b.brand_voice_doc ?? `Negocio: ${b.name}, Sector: ${b.sector}, Tono: ${b.tone}`,
      sector:        b.sector ?? 'otro',
      tone:          b.tone   ?? 'cercano',
      recentPosts:   (recentPosts ?? []).map((p: { caption: string }) => p.caption ?? ''),
    });

    // Save to brand_trends
    const { data: brandTrend } = await supabase
      .from('brand_trends')
      .insert({
        brand_id:            b.id,
        trend_id:            trendId,
        adapted_caption:     adapted.caption,
        adapted_hashtags:    adapted.hashtags,
        visual_instructions: adapted.visualInstructions,
        urgency:             adapted.urgency,
        status:              'suggested',
      })
      .select()
      .single();

    // Create notification
    await supabase.from('notifications').insert({
      brand_id: b.id,
      type:     'trend_detected',
      message:  `🔥 Nueva tendencia viral adaptada a tu negocio: ${adapted.adaptedTitle}`,
      metadata: { brand_trend_id: brandTrend?.id, urgency: adapted.urgency },
    });

    return NextResponse.json({ brandTrend, adapted });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
