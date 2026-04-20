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

  // ── Step 1: Claude writes the Kling prompt using Vision ──────────────────
  // Vision-first approach: Claude sees the image, describes what's already there,
  // then applies the user's motion request ON TOP — without reinventing the scene.
  type ContentBlock =
    | { type: 'image'; source: { type: 'url'; url: string } }
    | { type: 'text'; text: string };

  const hasUserRequest = input.userPrompt.trim().length > 0;

  const visionContent: ContentBlock[] = [];

  if (input.referenceImageUrl) {
    visionContent.push({
      type: 'image',
      source: { type: 'url', url: input.referenceImageUrl },
    });
  }

  visionContent.push({
    type: 'text',
    text: `You are a video prompt engineer for Kling v2 AI (img2video).

${input.referenceImageUrl
  ? `FIRST: Look at this image carefully. Identify: the main subject, the setting, the mood, colors, and lighting. This image is the FIRST FRAME of the video — preserve it completely.

THEN: Write a ${duration}-second Kling v2 video prompt that:
1. Keeps the scene EXACTLY as it appears in the image (same subject, same setting, same mood)
2. Applies ONLY this motion/change the user requested: "${hasUserRequest ? input.userPrompt : 'smooth natural ambient motion, subtle camera drift'}"
3. Does NOT add new elements, people, or locations that aren't in the image`
  : `Write a ${duration}-second Kling v2 video prompt based on this request: "${input.userPrompt}"`}

Context:
- Sector: ${input.sector}
- Visual style: ${input.visualStyle} — ${VIDEO_STYLE_GUIDE[input.visualStyle]}
- Brand: ${input.brandContext}
${brandRules.length ? `- Brand rules:\n${brandRules.map(r => `  • ${r}`).join('\n')}` : ''}

Prompt requirements:
- Describe camera movement precisely: "slow dolly in", "static shot", "gentle pan left"
- Describe what moves in the scene and how (hair, steam, leaves, liquid, etc.)
- Realistic, smooth motion only — no surreal or impossible physics
- No text overlays or logos
- Format: 9:16 vertical Reel, ${duration} seconds

Reply ONLY with the video prompt in English. 2-3 sentences max.`,
  });

  const promptMsg = await anthropic.messages.create({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 250,
    messages:   [{ role: 'user', content: visionContent as Anthropic.MessageParam['content'] }],
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
