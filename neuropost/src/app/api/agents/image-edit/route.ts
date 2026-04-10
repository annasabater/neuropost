import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { runImageEditAgent } from '@/agents/ImageEditAgent';
import type { VisualStyle, Brand, BrandRules } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function POST(request: Request) {
  try {
    const user    = await requireServerUser();
    const supabase = await createServerClient() as DB;

    const body = await request.json() as {
      imageUrl:         string;
      editingNarrative: string;
      editLevel?:       number;    // 0-4, default 2
    };

    if (!body.imageUrl)         return NextResponse.json({ error: 'imageUrl is required' },         { status: 400 });
    if (!body.editingNarrative) return NextResponse.json({ error: 'editingNarrative is required' }, { status: 400 });

    const { data: brand } = await supabase
      .from('brands')
      .select('id, name, tone, sector, visual_style, plan, colors, rules')
      .eq('user_id', user.id)
      .single();

    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const typedBrand = brand as Brand;
    const brandContext = `${typedBrand.name} · ${typedBrand.sector} · tono: ${typedBrand.tone ?? 'cercano'}`;
    const rules = (typedBrand.rules ?? null) as BrandRules | null;

    const result = await runImageEditAgent({
      imageUrl:         body.imageUrl,
      editingNarrative: body.editingNarrative,
      editLevel:        body.editLevel ?? 2,
      visualStyle:      (typedBrand.visual_style ?? 'warm') as VisualStyle,
      brandContext,
      brandId:          typedBrand.id,
      colors:           typedBrand.colors,
      forbiddenWords:   rules?.forbiddenWords,
      noEmojis:         rules?.noEmojis,
    });

    // Log activity
    await supabase.from('activity_log').insert({
      brand_id:    typedBrand.id,
      user_id:     user.id,
      action:      'image_edited',
      entity_type: 'image',
      details:     {
        edit_level:    body.editLevel ?? 2,
        credits_used:  result.creditsUsed,
        generation_ms: result.generationMs,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        editedImageUrl: result.editedImageUrl,
        editPrompt:     result.editPrompt,
        creditsUsed:    result.creditsUsed,
        generationMs:   result.generationMs,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
