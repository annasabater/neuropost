// =============================================================================
// NEUROPOST — ImageGenerateAgent
// Step 1: Claude enhances the user's prompt for the target style/sector
// Step 2: Nano Banana 2 generates the image
// Step 3: Upload result to Supabase Storage (assets bucket)
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';
import { generateImage } from '@/lib/imageGeneration';
import type { NanoBananaQuality } from '@/lib/nanoBanana';
import type { VisualStyle, SocialSector, BrandColors } from '@/types';

const anthropic = new Anthropic();

export interface ImageGenerateInput {
  userPrompt:      string;
  sector:          SocialSector;
  visualStyle:     VisualStyle;
  brandContext:    string;        // brand name, tone, keywords
  /** Brand palette — injected into the enhanced prompt. */
  colors?:         BrandColors | null;
  /** Words to avoid in any overlay text / subject copy. */
  forbiddenWords?: string[];
  /** If true, no emojis/emoticons should appear in the generated image. */
  noEmojis?:       boolean;
  quality?:        NanoBananaQuality;
  format?:         'post' | 'story' | 'reel_cover';
  brandId?:        string;        // if provided, uploads to Supabase
}

export interface ImageGenerateOutput {
  imageUrl:       string;
  enhancedPrompt: string;
  creditsUsed:    number;
  generationMs?:  number;
}

// ─── Dimensions per format ────────────────────────────────────────────────────

const DIMENSIONS: Record<string, { width: number; height: number }> = {
  post:       { width: 1080, height: 1080 },   // square IG
  story:      { width: 1080, height: 1920 },   // 9:16 vertical
  reel_cover: { width: 1080, height: 1350 },   // 4:5 IG
};

// ─── Style guidance for Claude ────────────────────────────────────────────────

const STYLE_GUIDE: Record<VisualStyle, string> = {
  creative:  'very saturated and vibrant colors, bold compositions, flat color backgrounds or eye-catching gradients, dramatic lighting, pop/editorial aesthetic',
  elegant:   'neutral and soft tones, lots of negative space, soft natural light, symmetrical compositions, luxury editorial aesthetic, understated',
  warm:      'warm tones (orange, ochre, brown), natural textures, golden hour light, welcoming atmosphere, artisanal handcrafted aesthetic',
  dynamic:   'high contrast, dark tones with bright accents, dramatic angles, energy and movement, urban street aesthetic',
  editorial: 'natural muted tones, documentary-style composition, authentic storytelling, real-life context, slight film grain',
  dark:      'very dark backgrounds, moody low-key lighting, deep shadows, luxurious and exclusive, minimal highlights',
  fresh:     'bright whites and soft greens, airy open spaces, natural daylight, organic minimalist, health and wellness feel',
  vintage:   'warm sepia and amber tones, soft faded colors, retro textures, nostalgic warmth, artisanal craftsmanship feel',
};

// ─── Negative prompt ──────────────────────────────────────────────────────────

const NEGATIVE_PROMPT = [
  'blurry', 'low quality', 'distorted', 'ugly', 'bad composition',
  'oversaturated', 'pixelated', 'watermark', 'text overlay', 'logo',
  'poorly lit', 'amateur', 'noise', 'grain',
].join(', ');

// ─── Agent ────────────────────────────────────────────────────────────────────

export async function runImageGenerateAgent(
  input: ImageGenerateInput,
): Promise<ImageGenerateOutput> {
  const start = Date.now();
  const { width, height } = DIMENSIONS[input.format ?? 'post'];

  // Build brand-aware constraint lines that Claude should take into account.
  const brandRules: string[] = [];
  if (input.colors?.primary) {
    brandRules.push(`Primary brand color: ${input.colors.primary}${input.colors.secondary ? `, secondary ${input.colors.secondary}` : ''}. Weave these colors into the composition naturally (props, background, accents).`);
  }
  if (input.forbiddenWords?.length) {
    brandRules.push(`Do NOT render any of these words visibly in the image: ${input.forbiddenWords.join(', ')}.`);
  }
  if (input.noEmojis) {
    brandRules.push('Do NOT include emoji characters or cartoonish icons in the image.');
  }

  // ── Step 1: Claude enhances the prompt ──────────────────────────────────────
  const promptMsg = await anthropic.messages.create({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 400,
    messages: [{
      role:    'user',
      content: `The user wants to generate this image for Instagram:
"${input.userPrompt}"

Business sector: ${input.sector}
Visual style: ${input.visualStyle} — ${STYLE_GUIDE[input.visualStyle]}
Brand context: ${input.brandContext}
Format: ${input.format ?? 'post'} (${width}×${height}px)
${brandRules.length ? `\nBrand rules (must follow):\n${brandRules.map(r => `- ${r}`).join('\n')}\n` : ''}
Improve this prompt to get the best possible image for Instagram with Nano Banana 2.

Requirements:
- Photo type (product shot, lifestyle, flat lay, overhead...)
- Lighting (natural light, studio light, golden hour, dramatic...)
- Composition (centered, rule of thirds, overhead, close-up...)
- Quality keywords (photorealistic, 4K, professional photography...)
- Style specific to the sector and visual style

Reply ONLY with the enhanced prompt in English, no explanations, no quotes.`,
    }],
  });

  const enhancedPrompt = promptMsg.content[0].type === 'text'
    ? promptMsg.content[0].text.trim()
    : input.userPrompt;

  // ── Step 2: Generate with Nano Banana 2 ─────────────────────────────────────
  const result = await generateImage({
    prompt:          enhancedPrompt,
    negative_prompt: NEGATIVE_PROMPT,
    width,
    height,
    quality:         input.quality ?? 'pro',
    output_format:   'jpg',
  });

  // ── Step 3: Upload to Supabase Storage if brandId provided ──────────────────
  let finalUrl = result.image_url;

  if (input.brandId) {
    try {
      const { createServerClient } = await import('@/lib/supabase');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = await createServerClient() as any;

      const imageRes  = await fetch(result.image_url);
      const imageBlob = await imageRes.blob();
      const fileName  = `generated/nb2-${Date.now()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('assets')
        .upload(fileName, imageBlob, { contentType: 'image/jpeg', upsert: false });

      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(fileName);
        finalUrl = publicUrl;
      }
    } catch (uploadErr) {
      console.warn('Supabase upload failed, returning direct URL:', uploadErr);
    }
  }

  return {
    imageUrl:       finalUrl,
    enhancedPrompt,
    creditsUsed:    result.credits_used,
    generationMs:   Date.now() - start,
  };
}
