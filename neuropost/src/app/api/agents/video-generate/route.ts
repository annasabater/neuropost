import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { runVideoGenerateAgent } from '@/agents/VideoGenerateAgent';
import type { VisualStyle, SocialSector, Brand } from '@/types';
import type { RunwayDuration } from '@/lib/runway';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function POST(request: Request) {
  try {
    const user     = await requireServerUser();
    const supabase  = await createServerClient() as DB;

    const body = await request.json() as {
      userPrompt:         string;
      referenceImageUrl?: string;   // optional: animate an existing photo
      duration?:          RunwayDuration;
    };

    if (!body.userPrompt?.trim()) {
      return NextResponse.json({ error: 'userPrompt is required' }, { status: 400 });
    }

    const { data: brand } = await supabase
      .from('brands')
      .select('id, name, sector, tone, hashtags, visual_style, plan')
      .eq('user_id', user.id)
      .single();

    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const typedBrand  = brand as Brand;
    const brandContext = [
      `Negoci: ${typedBrand.name}`,
      `Sector: ${typedBrand.sector}`,
      `Ton: ${typedBrand.tone ?? 'proper i directe'}`,
    ].join(' | ');

    const result = await runVideoGenerateAgent({
      userPrompt:         body.userPrompt,
      sector:             typedBrand.sector as SocialSector,
      visualStyle:        (typedBrand.visual_style ?? 'warm') as VisualStyle,
      brandContext,
      referenceImageUrl:  body.referenceImageUrl,
      duration:           body.duration ?? 5,
      brandId:            typedBrand.id,
    });

    // Log activity
    await supabase.from('activity_log').insert({
      brand_id:    typedBrand.id,
      user_id:     user.id,
      action:      'reel_generated',
      entity_type: 'video',
      details:     {
        runway_task_id: result.runwayTaskId,
        duration_sec:   result.durationSec,
        generation_ms:  result.generationMs,
        has_reference:  !!body.referenceImageUrl,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        videoUrl:       result.videoUrl,
        runwayTaskId:   result.runwayTaskId,
        enhancedPrompt: result.enhancedPrompt,
        durationSec:    result.durationSec,
        generationMs:   result.generationMs,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
