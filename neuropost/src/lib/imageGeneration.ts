// =============================================================================
// NEUROPOST — Unified image generation with automatic fallback
// Primary:  Nano Banana 2 (fast, high quality, Instagram-optimised)
// Fallback: Replicate Flux Dev (when NB2 is unavailable)
// =============================================================================

import { generateWithNanoBanana, editWithNanoBanana } from './nanoBanana';
import type { NanoBananaQuality, NanoBananaFormat, NanoBananaResponse } from './nanoBanana';

export type { NanoBananaQuality as ImageQuality };

export interface GenerateImageParams {
  prompt:           string;
  negative_prompt?: string;
  width?:           number;
  height?:          number;
  quality?:         NanoBananaQuality;
  output_format?:   NanoBananaFormat;
}

export interface EditImageParams {
  imageUrl:  string;
  prompt:    string;
  strength?: number;        // 0.0–1.0
  quality?:  NanoBananaQuality;
}

// ─── Replicate fallback (Flux Dev) ────────────────────────────────────────────

async function generateWithReplicate(params: GenerateImageParams): Promise<NanoBananaResponse> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN is not configured');

  const res = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-dev/predictions', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      input: {
        prompt:      params.prompt,
        width:       params.width  ?? 1024,
        height:      params.height ?? 1024,
        output_format: params.output_format ?? 'jpg',
        num_outputs: 1,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(`Replicate error: ${err.detail ?? res.statusText}`);
  }

  // Poll for completion
  const prediction = await res.json() as { id: string; urls: { get: string } };
  const pollUrl = prediction.urls.get;

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(pollUrl, { headers: { Authorization: `Bearer ${token}` } });
    const result = await poll.json() as { status: string; output?: string[]; error?: string };
    if (result.status === 'succeeded') {
      return { image_url: result.output?.[0] ?? '', generation_time: i * 2, credits_used: 1 };
    }
    if (result.status === 'failed') throw new Error(`Replicate failed: ${result.error}`);
  }

  throw new Error('Replicate prediction timed out');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Generate a new image. Tries Nano Banana 2 first, falls back to Replicate. */
export async function generateImage(params: GenerateImageParams): Promise<NanoBananaResponse> {
  try {
    return await generateWithNanoBanana(params);
  } catch (nanoBananaError) {
    console.error('Nano Banana 2 error, trying Replicate fallback:', nanoBananaError);
    try {
      return await generateWithReplicate(params);
    } catch (replicateError) {
      console.error('Replicate fallback also failed:', replicateError);
      throw new Error('No hem pogut generar la imatge ara mateix. Torna-ho a provar en uns moments.');
    }
  }
}

/** Edit an existing image. Tries Nano Banana 2 first, no Replicate fallback for edits. */
export async function editImage(params: EditImageParams): Promise<NanoBananaResponse> {
  try {
    return await editWithNanoBanana(params.imageUrl, params.prompt, params.strength ?? 0.5);
  } catch (err) {
    console.error('Nano Banana 2 edit error:', err);
    throw new Error('No hem pogut editar la imatge ara mateix. Torna-ho a provar en uns moments.');
  }
}
