// =============================================================================
// NEUROPOST — Nano Banana 2 (Gemini 3.1 Flash Image) API client
// Docs: https://api.banana2api.com / https://api.nanobanana.org
// =============================================================================

const NANO_BANANA_API_URL = 'https://api.banana2api.com/v1/generate';
const NANO_BANANA_EDIT_URL = 'https://api.banana2api.com/v1/edit';

export type NanoBananaQuality = 'fast' | 'pro' | 'ultra';
export type NanoBananaFormat  = 'jpg' | 'png' | 'webp';

export interface NanoBananaRequest {
  prompt:           string;
  negative_prompt?: string;
  width?:           number;
  height?:          number;
  quality?:         NanoBananaQuality;
  output_format?:   NanoBananaFormat;
}

export interface NanoBananaResponse {
  image_url:       string;
  generation_time: number;
  credits_used:    number;
}

export async function generateWithNanoBanana(
  params: NanoBananaRequest,
): Promise<NanoBananaResponse> {
  const apiKey = process.env.NANO_BANANA_API_KEY;
  if (!apiKey) throw new Error('NANO_BANANA_API_KEY is not configured');

  const res = await fetch(NANO_BANANA_API_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt:          params.prompt,
      negative_prompt: params.negative_prompt ?? '',
      width:           params.width           ?? 1024,
      height:          params.height          ?? 1024,
      quality:         params.quality         ?? 'pro',
      output_format:   params.output_format   ?? 'jpg',
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(`Nano Banana API error: ${err.message ?? res.statusText}`);
  }

  return res.json() as Promise<NanoBananaResponse>;
}

export async function editWithNanoBanana(
  imageUrl: string,
  prompt:   string,
  strength: number = 0.5,
): Promise<NanoBananaResponse> {
  const apiKey = process.env.NANO_BANANA_API_KEY;
  if (!apiKey) throw new Error('NANO_BANANA_API_KEY is not configured');

  const res = await fetch(NANO_BANANA_EDIT_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      image_url:     imageUrl,
      prompt,
      strength,
      quality:       'pro',
      output_format: 'jpg',
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(`Nano Banana edit error: ${err.message ?? res.statusText}`);
  }

  return res.json() as Promise<NanoBananaResponse>;
}
