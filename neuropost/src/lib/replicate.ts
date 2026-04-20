// =============================================================================
// Replicate async prediction helper
// Creates a prediction and returns immediately (webhook-based)
// =============================================================================

export interface ReplicatePrediction {
  id: string;
  status: string;
  urls: { get: string; cancel: string };
}

export interface RecreateImageParams {
  prompt: string;
  imageUrl?: string;   // Reference image for img2img (optional)
  width?: number;
  height?: number;
  webhookUrl: string;
}

/**
 * Starts an async Replicate prediction using Flux Dev.
 * Returns the prediction ID immediately — result comes via webhook.
 */
export async function startReplicatePrediction(params: RecreateImageParams): Promise<ReplicatePrediction> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN is not configured');

  // Flux Dev is a text-to-image model. It does NOT support img2img via
  // `image` + `prompt_strength` (those are Stable Diffusion parameters).
  // When a reference image is provided, we incorporate its description
  // into the prompt instead. The `imageUrl` field is intentionally NOT
  // passed to Flux Dev — doing so caused the model to return the original
  // reference image unmodified.
  const input: Record<string, unknown> = {
    prompt: params.imageUrl
      ? `${params.prompt}. Use this as visual reference style.`
      : params.prompt,
    width:  params.width  ?? 1024,
    height: params.height ?? 1024,
    output_format: 'jpg',
    num_outputs: 1,
    num_inference_steps: 28,
    guidance_scale: 3.5,
  };

  const res = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-dev/predictions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
      'Prefer': 'respond-async',
    },
    body: JSON.stringify({
      input,
      webhook: params.webhookUrl,
      webhook_events_filter: ['completed'],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(`Replicate error: ${err.detail ?? res.statusText}`);
  }

  return res.json() as Promise<ReplicatePrediction>;
}
