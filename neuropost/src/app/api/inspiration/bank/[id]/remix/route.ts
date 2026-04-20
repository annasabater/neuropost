// =============================================================================
// NEUROPOST — Remix an inspiration_bank item
// Fuses the user's request (priority) with the hidden_prompt (style/background
// reference) and calls ImageGenerateAgent in img2img mode when we have a
// reference image URL. Creates a post in status='pending'.
// =============================================================================

import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient, createAdminClient } from '@/lib/supabase';
import { checkPostLimit, incrementPostCounter } from '@/lib/plan-limits';
import { runImageGenerateAgent } from '@/agents/ImageGenerateAgent';
import { apiError } from '@/lib/api-utils';
import type { Brand, BrandRules, VisualStyle, SocialSector } from '@/types';

export const runtime     = 'nodejs';
export const maxDuration = 120;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

interface InspirationBankRow {
  id:               string;
  media_type:       string;
  thumbnail_url:    string | null;
  media_urls:       string[];
  hidden_prompt:    string;
  category:         string;
  mood:             string | null;
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const user     = await requireServerUser();
    const body     = await request.json() as {
      user_prompt:        string;
      format?:            'image' | 'carousel' | 'reel';
      reference_override?: string | null;   // optional: user-provided photo
    };

    if (!body.user_prompt?.trim()) {
      return NextResponse.json({ error: 'user_prompt is required' }, { status: 400 });
    }

    const supabase = await createServerClient() as DB;

    // ── Load brand + check limits ─────────────────────────────────────────────
    const { data: brandRow } = await supabase
      .from('brands').select('*').eq('user_id', user.id).single();
    if (!brandRow) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    const brand = brandRow as Brand;

    const gate = await checkPostLimit(brand.id);
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.reason, upgradeUrl: gate.upgradeUrl }, { status: 402 });
    }

    // ── Load the inspiration item (admin client — bypasses RLS on hidden_prompt) ─
    const admin = createAdminClient() as DB;
    const { data: itemRow, error: itemErr } = await admin
      .from('inspiration_bank')
      .select('id, media_type, thumbnail_url, media_urls, hidden_prompt, category, mood')
      .eq('id', id)
      .single();

    if (itemErr || !itemRow) {
      return NextResponse.json({ error: 'Inspiration item not found' }, { status: 404 });
    }
    const item = itemRow as InspirationBankRow;

    // ── Build the prompt: user request first, hidden_prompt as background ────
    //   The user's text drives the subject/composition/action.
    //   The hidden_prompt contributes style, mood, colors.
    const mergedPrompt = [
      body.user_prompt.trim(),
      `Use the following reference style as inspiration only (do not change the subject above): ${item.hidden_prompt}`,
    ].join('\n\n');

    const referenceImageUrl = body.reference_override ?? item.thumbnail_url ?? item.media_urls?.[0] ?? undefined;

    const rules = (brand.rules ?? null) as BrandRules | null;
    const brandContext = [
      `Brand: ${brand.name}`,
      `Sector: ${brand.sector}`,
      `Tone: ${brand.tone ?? 'neutral'}`,
    ].join(' | ');

    // ── Generate ──────────────────────────────────────────────────────────────
    const result = await runImageGenerateAgent({
      userPrompt:        mergedPrompt,
      sector:            brand.sector as SocialSector,
      visualStyle:       (brand.visual_style ?? 'warm') as VisualStyle,
      brandContext,
      colors:            brand.colors,
      forbiddenWords:    rules?.forbiddenWords,
      noEmojis:          rules?.noEmojis,
      referenceImageUrl,
      format:            body.format === 'reel' ? 'reel_cover' : 'post',
      brandId:           brand.id,
      // editStrength left at default (0.45 in agent) — keeps the reference close
    });

    // ── Save as a pending post ───────────────────────────────────────────────
    const { data: post, error: postErr } = await supabase
      .from('posts')
      .insert({
        brand_id:        brand.id,
        caption:         '',
        image_url:       result.imageUrl,
        status:          'pending',
        format:          body.format ?? 'image',
        platform:        ['instagram'],
        ai_explanation:  JSON.stringify({
          from_inspiration_bank: true,
          bank_item_id:          item.id,
          bank_category:         item.category,
          enhanced_prompt:       result.enhancedPrompt,
        }),
      })
      .select('id')
      .single();

    if (postErr) {
      console.error('[inspiration/remix] post insert failed:', postErr);
    } else {
      await incrementPostCounter(brand.id);
    }

    return NextResponse.json({
      success: true,
      data: {
        imageUrl:       result.imageUrl,
        enhancedPrompt: result.enhancedPrompt,
        mode:           result.mode,
        postId:         post?.id ?? null,
      },
    });
  } catch (err) {
    return apiError(err, 'POST /api/inspiration/bank/[id]/remix');
  }
}
