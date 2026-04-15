// =============================================================================
// NEUROPOST — Higgsfield AI cloud client
// https://cloud.higgsfield.ai
//
// Usado para generar fotos y vídeos con personas/sujetos humanos.
// Reemplaza NanaBanana + RunwayML cuando el contenido requiere gente real.
//
// ⚠️  Confirmar endpoints exactos en: https://cloud.higgsfield.ai/docs
//     La estructura de polling es idéntica a RunwayML (task-based async).
// =============================================================================

const HIGGSFIELD_BASE = 'https://cloud.higgsfield.ai';

// ─── Types ────────────────────────────────────────────────────────────────────

export type HiggsAspectRatio = '1:1' | '9:16' | '16:9' | '4:5';
export type HiggsDuration    = 3 | 5 | 8;

export interface HiggsImageParams {
  prompt:            string;
  negative_prompt?:  string;
  aspect_ratio?:     HiggsAspectRatio;
  /** Number of output images (default 1) */
  num_outputs?:      number;
  seed?:             number;
}

export interface HiggsVideoParams {
  prompt:              string;
  negative_prompt?:    string;
  aspect_ratio?:       HiggsAspectRatio;
  duration?:           HiggsDuration;
  /** Optional reference image to animate (URL) */
  reference_image_url?: string;
  seed?:               number;
}

export interface HiggsTask {
  id:          string;
  status:      'pending' | 'processing' | 'completed' | 'failed';
  output?:     Array<{ url: string; type: 'image' | 'video' }>;
  error?:      string;
  created_at:  string;
  updated_at:  string;
}

// ─── HTTP client ──────────────────────────────────────────────────────────────

function headers(): Record<string, string> {
  const key = process.env.HIGGSFIELD_API_KEY;
  if (!key) throw new Error('HIGGSFIELD_API_KEY is not configured');
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${key}`,
  };
}

async function higgsFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res  = await fetch(`${HIGGSFIELD_BASE}${path}`, { ...init, headers: headers() });
  const body = await res.json() as T & { error?: string; message?: string };
  if (!res.ok) {
    const msg = (body as { error?: string; message?: string }).error
             ?? (body as { error?: string; message?: string }).message
             ?? res.statusText;
    throw new Error(`Higgsfield error (${res.status}): ${msg}`);
  }
  return body;
}

// ─── Task creation ────────────────────────────────────────────────────────────

export async function createHiggsImageTask(params: HiggsImageParams): Promise<HiggsTask> {
  return higgsFetch<HiggsTask>('/api/v1/photo', {
    method: 'POST',
    body:   JSON.stringify({
      prompt:          params.prompt,
      negative_prompt: params.negative_prompt ?? 'blurry, low quality, watermark, text, logo',
      aspect_ratio:    params.aspect_ratio    ?? '1:1',
      num_outputs:     params.num_outputs     ?? 1,
      ...(params.seed != null ? { seed: params.seed } : {}),
    }),
  });
}

export async function createHiggsVideoTask(params: HiggsVideoParams): Promise<HiggsTask> {
  return higgsFetch<HiggsTask>('/api/v1/video', {
    method: 'POST',
    body:   JSON.stringify({
      prompt:          params.prompt,
      negative_prompt: params.negative_prompt ?? 'blurry, low quality, watermark, text overlay',
      aspect_ratio:    params.aspect_ratio    ?? '9:16',
      duration:        params.duration        ?? 5,
      ...(params.reference_image_url ? { reference_image_url: params.reference_image_url } : {}),
      ...(params.seed != null ? { seed: params.seed } : {}),
    }),
  });
}

// ─── Polling ──────────────────────────────────────────────────────────────────

export async function getHiggsTask(taskId: string): Promise<HiggsTask> {
  return higgsFetch<HiggsTask>(`/api/v1/task/${taskId}`);
}

async function waitForHiggsTask(
  taskId:         string,
  pollIntervalMs: number = 4000,
  maxAttempts:    number = 60,
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    const task = await getHiggsTask(taskId);

    if (task.status === 'completed') {
      const url = task.output?.[0]?.url;
      if (!url) throw new Error('Higgsfield task completed but returned no output URL');
      return url;
    }
    if (task.status === 'failed') {
      throw new Error(`Higgsfield generation failed: ${task.error ?? 'unknown reason'}`);
    }
  }
  const timeoutMin = ((pollIntervalMs * maxAttempts) / 60_000).toFixed(1);
  throw new Error(`Higgsfield task timed out after ${timeoutMin} minutes`);
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

export async function generateHiggsImage(
  params: HiggsImageParams,
): Promise<{ imageUrl: string; taskId: string }> {
  const task     = await createHiggsImageTask(params);
  const imageUrl = await waitForHiggsTask(task.id, 3000, 40);
  return { imageUrl, taskId: task.id };
}

export async function generateHiggsVideo(
  params: HiggsVideoParams,
): Promise<{ videoUrl: string; taskId: string }> {
  const task     = await createHiggsVideoTask(params);
  const videoUrl = await waitForHiggsTask(task.id, 5000, 60);
  return { videoUrl, taskId: task.id };
}
