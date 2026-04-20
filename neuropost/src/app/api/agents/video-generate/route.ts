import { NextResponse } from 'next/server';

// Kling v2 takes ~60s — extend the function timeout to 300s (Vercel max)
export const maxDuration = 300;
import { rateLimitAgents } from '@/lib/ratelimit';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { runVideoGenerateAgent } from '@/agents/VideoGenerateAgent';
import { checkRateLimit } from '@/lib/ratelimit';
import { checkVideoLimit, incrementVideoCounter } from '@/lib/plan-limits';
import type { VisualStyle, SocialSector, Brand, BrandRules } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function POST(request: Request) {
  try {
    const rl = await rateLimitAgents(request);
    if (rl) return rl;
    const user    = await requireServerUser();

    const rateLimit = checkRateLimit(`video-gen:${user.id}`, 5, 60 * 60 * 1000); // 5/hour per user
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Límite de generaciones de vídeo alcanzado. Inténtalo en una hora.' }, { status: 429 });
    }

    const supabase  = await createServerClient() as DB;

    const body = await request.json() as {
      userPrompt:         string;
      referenceImageUrl?: string;   // required for Kling img2video
      duration?:          5 | 10;
    };

    if (!body.userPrompt?.trim()) {
      return NextResponse.json({ error: 'userPrompt is required' }, { status: 400 });
    }

    const { data: brand } = await supabase
      .from('brands')
      .select('id, name, sector, tone, hashtags, visual_style, plan, colors, rules')
      .eq('user_id', user.id)
      .single();

    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const typedBrand  = brand as Brand;

    // Plan gate — checks both "is video allowed on this plan" AND the weekly
    // counter. Starter (videosPerWeek=0) is rejected immediately, and Pro/Total
    // will be blocked when they run out of their 2/10 weekly quota.
    const videoGate = await checkVideoLimit(typedBrand.id);
    if (!videoGate.allowed) {
      return NextResponse.json({ error: videoGate.reason, upgradeUrl: videoGate.upgradeUrl }, { status: 402 });
    }
    const brandContext = [
      `Negoci: ${typedBrand.name}`,
      `Sector: ${typedBrand.sector}`,
      `Ton: ${typedBrand.tone ?? 'proper i directe'}`,
    ].join(' | ');

    const rules = (typedBrand.rules ?? null) as BrandRules | null;

    const result = await runVideoGenerateAgent({
      userPrompt:         body.userPrompt,
      sector:             typedBrand.sector as SocialSector,
      visualStyle:        (typedBrand.visual_style ?? 'warm') as VisualStyle,
      brandContext,
      referenceImageUrl:  body.referenceImageUrl,
      duration:           body.duration ?? 5,
      brandId:            typedBrand.id,
      colors:             typedBrand.colors,
      forbiddenWords:     rules?.forbiddenWords,
      noEmojis:           rules?.noEmojis,
    });

    // Increment the weekly video counter so the next call sees the new total.
    await incrementVideoCounter(typedBrand.id);

    // Log activity
    await supabase.from('activity_log').insert({
      brand_id:    typedBrand.id,
      user_id:     user.id,
      action:      'reel_generated',
      entity_type: 'video',
      details:     {
        provider:      'kling-v2',
        duration_sec:  result.durationSec,
        generation_ms: result.generationMs,
        credits_used:  result.creditsUsed,
        has_reference: !!body.referenceImageUrl,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        videoUrl:       result.videoUrl,
        enhancedPrompt: result.enhancedPrompt,
        durationSec:    result.durationSec,
        generationMs:   result.generationMs,
        creditsUsed:    result.creditsUsed,
      },
    });
  } catch (err) {
    return apiError(err, 'POST /api/agents/video-generate');
  }
}
