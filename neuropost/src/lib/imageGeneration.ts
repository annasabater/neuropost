// =============================================================================
// NEUROPOST — Image generation via Replicate
// txt2img: black-forest-labs/flux-pro  (photorealistic)
// img2img: black-forest-labs/flux-kontext-pro  (edit preserving subject)
// =============================================================================

export type ImageQuality = 'standard' | 'pro';

export interface GenerateImageParams {
  prompt:           string;
  negative_prompt?: string;
  width?:           number;
  height?:          number;
  quality?:         ImageQuality;
  output_format?:   'jpg' | 'png' | 'webp';
  guidance?:        number;
}

export interface EditImageParams {
  imageUrl:  string;
  prompt:    string;
  strength?: number;   // 0.0–1.0
  guidance?: number;
  quality?:  ImageQuality;
}

export interface ImageResponse {
  image_url:       string;
  generation_time: number;
  credits_used:    number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToken(): string {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN is not configured');
  return token;
}

async function pollPrediction(pollUrl: string, token: string): Promise<string> {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll   = await fetch(pollUrl, { headers: { Authorization: `Bearer ${token}` } });
    const result = await poll.json() as { status: string; output?: string[] | string; error?: string };
    if (result.status === 'succeeded') {
      const out = Array.isArray(result.output) ? result.output[0] : result.output;
      return out ?? '';
    }
    if (result.status === 'failed') throw new Error(`Replicate failed: ${result.error}`);
  }
  throw new Error('Replicate prediction timed out after 120s');
}

// ─── txt2img (Flux Pro — photorealistic) ─────────────────────────────────────

export async function generateImage(params: GenerateImageParams): Promise<ImageResponse> {
  const token = getToken();
  const t0    = Date.now();

  // flux-pro uses a versioned endpoint
  const res = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-pro/predictions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      input: {
        prompt:          params.prompt,
        width:           params.width         ?? 1024,
        height:          params.height        ?? 1024,
        output_format:   params.output_format ?? 'jpg',
        // Flux Pro params (no num_inference_steps — model handles quality internally)
        // guidance: higher = more prompt-adherent, lower = more creative
        guidance:        params.guidance ?? 3,
        // prompt_upsampling: false prevents the model from "hallucinating" extra details
        prompt_upsampling: false,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(`Replicate error: ${err.detail ?? res.statusText}`);
  }

  const prediction = await res.json() as { id: string; urls: { get: string } };
  const imageUrl   = await pollPrediction(prediction.urls.get, token);

  return {
    image_url:       imageUrl,
    generation_time: Math.round((Date.now() - t0) / 1000),
    credits_used:    1,
  };
}

// ─── img2img (Flux Kontext Pro) ───────────────────────────────────────────────
// Flux Kontext Pro is designed for image editing: it preserves the original
// subject/product and applies the prompt as targeted modifications.
// Much better than flux-dev image_prompt for keeping the original photo intact.

export async function editImage(params: EditImageParams): Promise<ImageResponse> {
  const token  = getToken();
  const t0     = Date.now();

  const res = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      input: {
        prompt:        params.prompt,
        input_image:   params.imageUrl,
        output_format: 'jpg',
        // guidance: lower = preserves original photo more faithfully
        // default is 2.5; we lower it to 2 so edits are more conservative
        guidance:      params.guidance ?? 2,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(`Replicate Kontext error: ${err.detail ?? res.statusText}`);
  }

  const prediction = await res.json() as { id: string; urls: { get: string } };
  const imageUrl   = await pollPrediction(prediction.urls.get, token);

  return {
    image_url:       imageUrl,
    generation_time: Math.round((Date.now() - t0) / 1000),
    credits_used:    1,
  };
}
