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

  const input: Record<string, unknown> = {
    prompt: params.prompt,
    width:  params.width  ?? 1024,
    height: params.height ?? 1024,
    output_format: 'jpg',
    num_outputs: 1,
    num_inference_steps: 28,
    guidance_scale: 3.5,
  };

  // If a reference image is provided, use img2img mode
  if (params.imageUrl) {
    input.image  = params.imageUrl;
    input.prompt_strength = 0.75; // How much to deviate from the reference
  }

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
