import { NextResponse } from 'next/server';
import { rateLimitAgents } from '@/lib/ratelimit';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { adaptTrendToBrand } from '@/agents/TrendsAgent';
import { checkFeature } from '@/lib/plan-limits';
import { normalizePreferences } from '@/lib/plan-features';
import type { Brand, BrandRules } from '@/types';

export async function POST(request: Request) {
  try {
    const rl = await rateLimitAgents(request);
    if (rl) return rl;
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

    // Plan gate — trends agent is a Total+ feature.
    const gate = await checkFeature(b.id, 'trendsAgent');
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.reason, upgradeUrl: gate.upgradeUrl }, { status: 402 });
    }

    // Get recent posts
    const { data: recentPosts } = await supabase
      .from('posts')
      .select('caption')
      .eq('brand_id', b.id)
      .order('created_at', { ascending: false })
      .limit(5);

    // Hydrate rules + preferences for the agent.
    const rules = (b.rules ?? null) as BrandRules | null;
    const prefs = normalizePreferences(b.plan, rules?.preferences);

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
      brandVoiceDoc:   b.brand_voice_doc ?? `Negocio: ${b.name}, Sector: ${b.sector}, Tono: ${b.tone}`,
      sector:          b.sector ?? 'otro',
      tone:            b.tone   ?? 'cercano',
      recentPosts:     (recentPosts ?? []).map((p: { caption: string }) => p.caption ?? ''),
      forbiddenWords:  rules?.forbiddenWords,
      forbiddenTopics: rules?.forbiddenTopics,
      noEmojis:        rules?.noEmojis,
      likesCarousels:  prefs.likesCarousels,
      includeVideos:   prefs.includeVideos,
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
    return apiError(err, 'POST /api/agents/trends/adapt');
  }
}
