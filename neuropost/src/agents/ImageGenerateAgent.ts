// =============================================================================
// NEUROPOST — ImageGenerateAgent
// Step 1: Claude enhances the user's prompt for the target style/sector
// Step 2: Nano Banana 2 generates the image
// Step 3: Upload result to Supabase Storage (assets bucket)
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';
import { generateImage, editImage } from '@/lib/imageGeneration';
import type { ImageQuality } from '@/lib/imageGeneration';
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
  quality?:        ImageQuality;
  format?:         'post' | 'story' | 'reel_cover';
  brandId?:        string;        // if provided, uploads to Supabase
  /**
   * When the user uploaded their own photo, this is its URL.
   * The agent will use img2img mode: analyse the image with Claude Vision
   * and then pass it to NanoBanana img2img so the output is derived from
   * the user's photo rather than generated from scratch.
   */
  referenceImageUrl?: string;
  /** img2img strength (0.0 = keep original, 1.0 = ignore it). Default 0.65 */
  editStrength?:   number;
  /** How many output images to generate (1–4). Default 1. */
  numOutputs?:     number;
}

export interface ImageGenerateOutput {
  imageUrl:        string;
  additionalUrls?: string[];   // extra images when numOutputs > 1
  enhancedPrompt:  string;
  creditsUsed:     number;
  generationMs?:   number;
  mode?:           'txt2img' | 'img2img';
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

  const hasRefImage = !!input.referenceImageUrl;

  // ── Step 1: Determine the prompt ─────────────────────────────────────────────
  // img2img: send the user's prompt directly to Replicate — no Claude in between.
  //          The user knows what they want; we don't translate or enhance it.
  // txt2img: Claude enhances the prompt for better generation quality.
  let enhancedPrompt: string;

  if (hasRefImage) {
    enhancedPrompt = input.userPrompt;
  } else {
    const claudeMsg = await anthropic.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages:   [{
        role: 'user',
        content: `You are a prompt engineer for a photorealistic image generator (Flux Pro).

The user's request (DO NOT change the subject or add elements they didn't ask for):
"${input.userPrompt}"

Context:
- Sector: ${input.sector}
- Visual style: ${input.visualStyle} — ${STYLE_GUIDE[input.visualStyle]}
- Brand: ${input.brandContext}
${brandRules.length ? `- Rules:\n${brandRules.map(r => `  • ${r}`).join('\n')}` : ''}

Your task: translate the user's request into a concise Flux Pro prompt.
RULES:
1. Keep EXACTLY what the user asked for — do not add new subjects, objects or scenes they didn't mention.
2. Only add: lighting style, camera angle, and 2-3 quality keywords (e.g. "photorealistic, sharp focus, professional photography").
3. Apply the visual style subtly through lighting and mood — not by changing the subject.
4. Maximum 80 words. English only. No explanations, no quotes.`,
      }],
    });
    enhancedPrompt = claudeMsg.content[0].type === 'text'
      ? claudeMsg.content[0].text.trim()
      : input.userPrompt;
  }

  // ── Step 2: Generate or edit with Nano Banana 2 ───────────────────────────────
  // img2img when user uploaded a photo; txt2img when generating from scratch.
  // For img2img (reference photo), always generate 1 output — multiple variations
  // confuse the client since each edit looks different from the original.
  const numOutputs = hasRefImage ? 1 : Math.min(Math.max(input.numOutputs ?? 1, 1), 4);
  const results: string[] = [];

  for (let i = 0; i < numOutputs; i++) {
    let r: Awaited<ReturnType<typeof generateImage>>;
    if (hasRefImage) {
      r = await editImage({
        imageUrl:  input.referenceImageUrl!,
        prompt:    enhancedPrompt,
        strength:  input.editStrength ?? 0.65,
        quality:   input.quality ?? 'pro',
      });
    } else {
      r = await generateImage({
        prompt:          enhancedPrompt,
        negative_prompt: NEGATIVE_PROMPT,
        width,
        height,
        quality:         input.quality ?? 'pro',
        output_format:   'jpg',
      });
    }
    results.push(r.image_url);
  }

  // Use first result as primary; pack extras into additionalUrls
  const result = { image_url: results[0], generation_time: 0, credits_used: numOutputs };

  // ── Step 3: Upload all results to Supabase Storage ───────────────────────────
  const uploadedUrls: string[] = [];

  for (const rawUrl of results) {
    let finalUrl = rawUrl;
    if (input.brandId) {
      try {
        const { createAdminClient } = await import('@/lib/supabase');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supabase = createAdminClient() as any;
        const imageRes  = await fetch(rawUrl);
        const imageBlob = await imageRes.blob();
        const prefix = hasRefImage ? 'edited' : 'generated';
        const fileName = `${prefix}/nb2-${Date.now()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}.jpg`;
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
    uploadedUrls.push(finalUrl);
  }

  return {
    imageUrl:        uploadedUrls[0],
    additionalUrls:  uploadedUrls.slice(1),
    enhancedPrompt,
    creditsUsed:     result.credits_used,
    generationMs:    Date.now() - start,
    mode:            hasRefImage ? 'img2img' : 'txt2img',
  };
}
