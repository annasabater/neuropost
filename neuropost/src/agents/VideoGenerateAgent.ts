// =============================================================================
// NEUROPOST — VideoGenerateAgent
// Generates Instagram Reels (9:16 MP4) using RunwayML Gen-4 Turbo.
//
// Flow:
//   1. Claude writes a cinematic video prompt optimised for RunwayML Gen-4
//   2. RunwayML Gen-4 Turbo generates a 5–10 s Reel (768×1280 or 1080×1920)
//   3. Video is downloaded + uploaded to Supabase Storage (assets bucket)
//   4. Returns the public Supabase URL for Meta publishing
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';
import { generateVideo } from '@/lib/runway';
import type { RunwayDuration } from '@/lib/runway';
import type { VisualStyle, SocialSector } from '@/types';

const anthropic = new Anthropic();

export interface VideoGenerateInput {
  userPrompt:    string;             // what the user wants
  sector:        SocialSector;
  visualStyle:   VisualStyle;
  brandContext:  string;
  referenceImageUrl?: string;        // optional: animate an existing photo
  duration?:     RunwayDuration;     // 5 or 10 seconds (default 5)
  brandId?:      string;
}

export interface VideoGenerateOutput {
  videoUrl:       string;            // Supabase public URL
  runwayTaskId:   string;
  enhancedPrompt: string;
  durationSec:    number;
  generationMs?:  number;
}

// ─── Style guide for video ────────────────────────────────────────────────────

const VIDEO_STYLE_GUIDE: Record<VisualStyle, string> = {
  creative: 'vibrant pop colors, dynamic camera movements, fast cuts feel, energetic transitions, bold product close-ups',
  elegant:  'slow smooth camera movement, soft golden light, minimal motion, luxurious slow-motion details',
  warm:     'golden hour lighting, gentle camera drift, warm cozy atmosphere, natural organic movement',
  dynamic:  'handheld energy, dramatic lighting shifts, fast motion, urban cinematic feel, high contrast',
};

// ─── Agent ────────────────────────────────────────────────────────────────────

export async function runVideoGenerateAgent(
  input: VideoGenerateInput,
): Promise<VideoGenerateOutput> {
  const start    = Date.now();
  const duration = input.duration ?? 5;

  // ── Step 1: Claude writes the optimal RunwayML prompt ─────────────────────
  const promptMsg = await anthropic.messages.create({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 350,
    messages: [{
      role:    'user',
      content: `Write a cinematic video prompt for RunwayML Gen-4 Turbo to generate an Instagram Reel.

User request: "${input.userPrompt}"
Sector: ${input.sector}
Visual style: ${input.visualStyle} — ${VIDEO_STYLE_GUIDE[input.visualStyle]}
Brand context: ${input.brandContext}
Duration: ${duration} seconds
Format: 9:16 vertical (Instagram Reel)
${input.referenceImageUrl ? 'A reference image will be provided — animate and extend it.' : 'Generate from text only.'}

Requirements for RunwayML Gen-4:
- Describe the scene, action, camera movement and lighting precisely
- Use cinematic language: "slow dolly forward", "rack focus", "golden hour sunlight"
- Describe what's happening in the first and last frame (for smooth loop feel)
- No text overlays or logos in the scene
- Keep it achievable in ${duration} seconds

Reply ONLY with the video prompt in English. 2-3 sentences max.`,
    }],
  });

  const enhancedPrompt = promptMsg.content[0].type === 'text'
    ? promptMsg.content[0].text.trim()
    : input.userPrompt;

  // ── Step 2: RunwayML Gen-4 Turbo generates the video ─────────────────────
  const { videoUrl: runwayUrl, taskId } = await generateVideo({
    promptText:   enhancedPrompt,
    promptImage:  input.referenceImageUrl,
    aspectRatio:  '768:1280',    // 9:16 vertical Reel
    duration,
  });

  // ── Step 3: Download + upload to Supabase Storage ────────────────────────
  let finalUrl = runwayUrl;

  if (input.brandId) {
    try {
      const { createServerClient } = await import('@/lib/supabase');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = await createServerClient() as any;

      const videoRes  = await fetch(runwayUrl);
      const videoBlob = await videoRes.blob();
      const fileName  = `reels/gen4-${Date.now()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}.mp4`;

      const { error: uploadErr } = await supabase.storage
        .from('assets')
        .upload(fileName, videoBlob, { contentType: 'video/mp4', upsert: false });

      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(fileName);
        finalUrl = publicUrl;
      }
    } catch (uploadErr) {
      console.warn('Supabase upload failed, using RunwayML direct URL:', uploadErr);
    }
  }

  return {
    videoUrl:       finalUrl,
    runwayTaskId:   taskId,
    enhancedPrompt,
    durationSec:    duration,
    generationMs:   Date.now() - start,
  };
}
