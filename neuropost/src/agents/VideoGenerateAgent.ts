// =============================================================================
// NEUROPOST — VideoGenerateAgent
// Generates Instagram Reels (9:16 MP4) using Kling v2 Master via fal.ai.
//
// Flow:
//   1. Claude writes a cinematic video prompt optimised for Kling v2
//   2. Kling v2 Master img2video generates a 5–10 s Reel
//   3. Video is downloaded + uploaded to Supabase Storage (assets bucket)
//   4. Returns the public Supabase URL for Meta publishing
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';
import { generateVideoFromImage } from '@/lib/videoGeneration';
import type { VisualStyle, SocialSector, BrandColors } from '@/types';

const anthropic = new Anthropic();

export interface VideoGenerateInput {
  userPrompt:    string;             // what the user wants
  sector:        SocialSector;
  visualStyle:   VisualStyle;
  brandContext:  string;
  referenceImageUrl?: string;        // optional: animate an existing photo
  duration?:     5 | 10;            // 5 or 10 seconds (default 5)
  brandId?:      string;
  /** Brand palette — injected into the cinematic prompt. */
  colors?:       BrandColors | null;
  /** Words to avoid in any overlay text. */
  forbiddenWords?: string[];
  /** If true, no emojis should appear. */
  noEmojis?:     boolean;
}

export interface VideoGenerateOutput {
  videoUrl:       string;            // Supabase public URL (or fal.ai CDN URL)
  enhancedPrompt: string;
  durationSec:    number;
  generationMs?:  number;
  creditsUsed?:   number;
}

// ─── Style guide for video ────────────────────────────────────────────────────

const VIDEO_STYLE_GUIDE: Record<VisualStyle, string> = {
  creative:  'vibrant pop colors, dynamic camera movements, fast cuts feel, energetic transitions, bold product close-ups',
  elegant:   'slow smooth camera movement, soft golden light, minimal motion, luxurious slow-motion details',
  warm:      'golden hour lighting, gentle camera drift, warm cozy atmosphere, natural organic movement',
  dynamic:   'handheld energy, dramatic lighting shifts, fast motion, urban cinematic feel, high contrast',
  editorial: 'steady documentary camera, natural available light, real-life moments, authentic pacing',
  dark:      'moody slow reveals, dramatic shadows, low-key lighting transitions, premium cinematic feel',
  fresh:     'bright airy footage, gentle movement, natural daylight, clean organic transitions',
  vintage:   'warm film grain overlay, nostalgic pacing, amber tones, gentle fades, retro feel',
};

// ─── Agent ────────────────────────────────────────────────────────────────────

export async function runVideoGenerateAgent(
  input: VideoGenerateInput,
): Promise<VideoGenerateOutput> {
  const start    = Date.now();
  const duration = input.duration ?? 5;

  // Brand constraints woven into the video prompt.
  const brandRules: string[] = [];
  if (input.colors?.primary) {
    brandRules.push(`Grade the footage toward the brand palette: primary ${input.colors.primary}${input.colors.secondary ? `, secondary ${input.colors.secondary}` : ''}.`);
  }
  if (input.forbiddenWords?.length) {
    brandRules.push(`Do NOT reference these concepts in the scene: ${input.forbiddenWords.join(', ')}.`);
  }
  if (input.noEmojis) {
    brandRules.push('No emoji-like icons or cartoonish overlays.');
  }

  // ── Step 1: Claude writes the optimal Kling prompt ───────────────────────
  const promptMsg = await anthropic.messages.create({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 350,
    messages: [{
      role:    'user',
      content: `Write a cinematic video prompt for Kling v2 AI to generate an Instagram Reel.

User request: "${input.userPrompt}"
Sector: ${input.sector}
Visual style: ${input.visualStyle} — ${VIDEO_STYLE_GUIDE[input.visualStyle]}
Brand context: ${input.brandContext}
Duration: ${duration} seconds
Format: 9:16 vertical (Instagram Reel)
${input.referenceImageUrl ? 'A reference image will be provided — animate and extend it realistically.' : 'Generate motion from the provided image.'}
${brandRules.length ? `\nBrand rules:\n${brandRules.map(r => `- ${r}`).join('\n')}\n` : ''}
Requirements for Kling v2:
- Describe the scene motion, camera movement and lighting precisely
- Use cinematic language: "slow dolly forward", "rack focus", "golden hour sunlight"
- Focus on realistic, smooth natural motion
- No text overlays or logos in the scene
- Keep it achievable in ${duration} seconds

Reply ONLY with the video prompt in English. 2-3 sentences max.`,
    }],
  });

  const enhancedPrompt = promptMsg.content[0].type === 'text'
    ? promptMsg.content[0].text.trim()
    : input.userPrompt;

  // ── Step 2: Kling v2 generates the video ─────────────────────────────────
  // Kling requires a reference image — use a placeholder if none provided.
  const imageUrl = input.referenceImageUrl ?? '';
  if (!imageUrl) {
    throw new Error('Kling v2 img2video requires a reference image URL. Please upload or select an image first.');
  }

  const klingResult = await generateVideoFromImage({
    imageUrl,
    prompt:    enhancedPrompt,
    duration:  duration === 10 ? '10' : '5',
    cfgScale:  0.5,
  });

  // ── Step 3: Download + upload to Supabase Storage ────────────────────────
  let finalUrl = klingResult.video_url;

  if (input.brandId) {
    try {
      const { createServerClient } = await import('@/lib/supabase');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = await createServerClient() as any;

      const videoRes  = await fetch(klingResult.video_url);
      const videoBlob = await videoRes.blob();
      const fileName  = `reels/kling2-${Date.now()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}.mp4`;

      const { error: uploadErr } = await supabase.storage
        .from('assets')
        .upload(fileName, videoBlob, { contentType: 'video/mp4', upsert: false });

      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(fileName);
        finalUrl = publicUrl;
      }
    } catch (uploadErr) {
      console.warn('Supabase upload failed, using fal.ai CDN URL:', uploadErr);
    }
  }

  return {
    videoUrl:       finalUrl,
    enhancedPrompt,
    durationSec:    duration,
    generationMs:   Date.now() - start,
    creditsUsed:    klingResult.credits_used,
  };
}
