// =============================================================================
// NEUROPOST — ImageEditAgent
// Takes an existing image + EditorAgent analysis → edits via Nano Banana 2
// → uploads result to Supabase Storage → returns edited image URL
//
// Flow:
//   1. Claude builds a precise edit prompt from the analysis narrative
//   2. Nano Banana 2 applies edits (img2img mode)
//   3. Uploads to Supabase Storage (posts bucket)
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';
import { editImage } from '@/lib/imageGeneration';
import type { VisualStyle } from '@/types';

const anthropic = new Anthropic();

// edit strength per editing level (0–4):
// 0 = no edit, 1 = light, 2 = moderate, 3 = strong, 4 = full
const STRENGTH_BY_LEVEL = [0, 0.2, 0.4, 0.6, 0.75];

export interface ImageEditInput {
  imageUrl:          string;       // publicly accessible URL of original image
  editingNarrative:  string;       // from EditorOutput.editingNarrative
  editLevel:         number;       // 0–4
  visualStyle:       VisualStyle;
  brandContext:      string;
  brandId?:          string;
}

export interface ImageEditOutput {
  editedImageUrl:  string;
  editPrompt:      string;
  creditsUsed:     number;
  generationMs?:   number;
}

// ─── Style edit hints for Claude ─────────────────────────────────────────────

const STYLE_EDIT_HINTS: Record<VisualStyle, string> = {
  creative: 'boost color saturation, make lighting more dramatic, increase contrast and vibrancy',
  elegant:  'reduce saturation to neutral tones, soften lighting, add subtle vignette, clean minimal feel',
  warm:     'add warm golden tones, soften highlights, enhance earthy colors, cozy atmosphere',
  dynamic:  'increase contrast dramatically, deepen shadows, sharpen details, high-energy look',
};

export async function runImageEditAgent(input: ImageEditInput): Promise<ImageEditOutput> {
  if (input.editLevel === 0) {
    return { editedImageUrl: input.imageUrl, editPrompt: 'no edit', creditsUsed: 0 };
  }

  const start = Date.now();
  const strength = STRENGTH_BY_LEVEL[Math.min(input.editLevel, 4)];

  // ── Step 1: Claude translates the analysis into a precise edit prompt ───────
  const promptMsg = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',   // fast + cheap for prompt translation
    max_tokens: 200,
    messages: [{
      role:    'user',
      content: `Convert this photo editing analysis into a concise img2img edit prompt for Nano Banana 2.

Analysis: ${input.editingNarrative}
Visual style target: ${input.visualStyle} — ${STYLE_EDIT_HINTS[input.visualStyle]}
Brand context: ${input.brandContext}
Edit intensity: ${input.editLevel}/4 (${Math.round(strength * 100)}% change)

Write ONLY the edit prompt in English. 1-2 sentences max. Be specific about:
- color adjustments
- lighting changes
- atmosphere/mood
Do NOT mention logos, text, or people changes.`,
    }],
  });

  const editPrompt = promptMsg.content[0].type === 'text'
    ? promptMsg.content[0].text.trim()
    : input.editingNarrative;

  // ── Step 2: Nano Banana 2 edits the image ───────────────────────────────────
  const result = await editImage({
    imageUrl: input.imageUrl,
    prompt:   editPrompt,
    strength,
  });

  // ── Step 3: Upload to Supabase Storage ──────────────────────────────────────
  let finalUrl = result.image_url;

  if (input.brandId) {
    try {
      const { createServerClient } = await import('@/lib/supabase');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = await createServerClient() as any;

      const imageRes  = await fetch(result.image_url);
      const imageBlob = await imageRes.blob();
      const fileName  = `edited/nb2-edit-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

      const { error: uploadErr } = await supabase.storage
        .from('posts')
        .upload(fileName, imageBlob, { contentType: 'image/jpeg', upsert: false });

      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(fileName);
        finalUrl = publicUrl;
      }
    } catch (uploadErr) {
      console.warn('Supabase upload failed, returning direct NB2 URL:', uploadErr);
    }
  }

  return {
    editedImageUrl: finalUrl,
    editPrompt,
    creditsUsed:    result.credits_used,
    generationMs:   Date.now() - start,
  };
}
