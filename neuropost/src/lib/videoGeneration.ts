// =============================================================================
// NEUROPOST — Video generation via fal.ai (Kling v2 Master img2video)
// Takes a reference photo + prompt and returns a short video for Reels/Stories
// =============================================================================

import { fal } from '@fal-ai/client';

function configure() {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY is not configured');
  fal.config({ credentials: key });
}

export interface GenerateVideoParams {
  /** URL of the reference photo (already hosted — Supabase Storage or Replicate CDN) */
  imageUrl:  string;
  /** Description of the desired motion / scene */
  prompt:    string;
  /** Duration in seconds — Kling supports "5" or "10" */
  duration?: '5' | '10';
  /** Lower = more faithful to original image. Range 0–1, default 0.5 */
  cfgScale?: number;
}

export interface VideoResponse {
  video_url:       string;
  generation_time: number;
  credits_used:    number;
}

export async function generateVideoFromImage(
  params: GenerateVideoParams,
): Promise<VideoResponse> {
  configure();
  const t0 = Date.now();

  const result = await fal.subscribe('fal-ai/kling-video/v2/master/image-to-video', {
    input: {
      image_url:       params.imageUrl,
      prompt:          params.prompt,
      duration:        params.duration ?? '5',
      cfg_scale:       params.cfgScale ?? 0.5,
      negative_prompt: 'blur, distort, low quality, watermark, text overlay',
    },
    mode:         'polling',
    pollInterval: 4000,
  });

  // result.data.video is a File-like object with a url property
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const video = (result.data as any)?.video;
  const videoUrl: string = video?.url ?? '';

  if (!videoUrl) throw new Error('Kling did not return a video URL');

  return {
    video_url:       videoUrl,
    generation_time: Math.round((Date.now() - t0) / 1000),
    credits_used:    1,
  };
}
