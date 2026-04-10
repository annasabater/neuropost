import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { runImageGenerateAgent } from '@/agents/ImageGenerateAgent';
import { IMAGE_QUALITY_BY_PLAN } from '@/lib/plan-limits';
import { checkRateLimit } from '@/lib/ratelimit';
import type { VisualStyle, SocialSector, SubscriptionPlan, BrandRules, BrandColors } from '@/types';
import type { NanoBananaQuality } from '@/lib/nanoBanana';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function POST(request: Request) {
  try {
    const user    = await requireServerUser();

    const rateLimit = checkRateLimit(`image-gen:${user.id}`, 20, 60 * 60 * 1000); // 20/hour per user
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Límite de generaciones alcanzado. Inténtalo en una hora.' }, { status: 429 });
    }

    const supabase = await createServerClient() as DB;

    const { userPrompt, format, quality: qualityOverride } = await request.json() as {
      userPrompt:      string;
      format?:         'post' | 'story' | 'reel_cover';
      quality?:        NanoBananaQuality;
    };

    if (!userPrompt?.trim()) {
      return NextResponse.json({ error: 'userPrompt is required' }, { status: 400 });
    }

    // Get brand context — full row so we can forward rules + colors to the agent.
    const { data: brand } = await supabase
      .from('brands')
      .select('id, name, sector, tone, hashtags, visual_style, plan, brand_voice_doc, colors, rules')
      .eq('user_id', user.id)
      .single();

    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    // Determine quality from plan (user can't request higher than their plan allows)
    const planQuality  = IMAGE_QUALITY_BY_PLAN[brand.plan as SubscriptionPlan] ?? 'fast';
    const qualityOrder: NanoBananaQuality[] = ['fast', 'pro', 'ultra'];
    const planLevel    = qualityOrder.indexOf(planQuality);
    const reqLevel     = qualityOverride ? qualityOrder.indexOf(qualityOverride) : planLevel;
    const quality      = qualityOrder[Math.min(reqLevel, planLevel)] as NanoBananaQuality;

    // Build brand context string for the agent
    const brandContext = [
      `Negoci: ${brand.name}`,
      `Sector: ${brand.sector}`,
      `Ton: ${brand.tone ?? 'proper i directe'}`,
      brand.hashtags?.length ? `Paraules clau: ${brand.hashtags.slice(0, 5).join(', ')}` : '',
    ].filter(Boolean).join(' | ');

    const rules = (brand.rules ?? null) as BrandRules | null;

    const result = await runImageGenerateAgent({
      userPrompt,
      sector:         brand.sector as SocialSector,
      visualStyle:    (brand.visual_style ?? 'warm') as VisualStyle,
      brandContext,
      colors:         (brand.colors ?? null) as BrandColors | null,
      forbiddenWords: rules?.forbiddenWords,
      noEmojis:       rules?.noEmojis,
      quality,
      format:         format ?? 'post',
      brandId:        brand.id,
    });

    // Activity log
    await supabase.from('activity_log').insert({
      brand_id:    brand.id,
      user_id:     user.id,
      action:      'image_generated',
      entity_type: 'image',
      details:     { quality, format, credits_used: result.creditsUsed, generation_ms: result.generationMs },
    });

    return NextResponse.json({
      success: true,
      data: {
        imageUrl:       result.imageUrl,
        enhancedPrompt: result.enhancedPrompt,
        creditsUsed:    result.creditsUsed,
        generationMs:   result.generationMs,
        quality,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
