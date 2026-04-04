// =============================================================================
// NEUROPOST — RunwayML Gen-4 Turbo API client
// Used for Reel (video) generation from image+prompt or text-only
// Docs: https://docs.dev.runwayml.com
// =============================================================================

const RUNWAY_API_BASE = 'https://api.dev.runwayml.com/v1';
const RUNWAY_MODEL    = 'gen4_turbo';

export type RunwayAspectRatio = '1280:768' | '768:1280' | '1104:832' | '832:1104' | '960:960';
export type RunwayDuration    = 5 | 10;

export interface RunwayGenerateParams {
  promptText:   string;
  promptImage?: string;        // public URL of a reference/source image
  aspectRatio?: RunwayAspectRatio;
  duration?:    RunwayDuration;
  seed?:        number;
}

export interface RunwayTask {
  id:         string;
  status:     'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  output?:    string[];        // array of video URLs on success
  failure?:   string;
  createdAt:  string;
  updatedAt:  string;
}

function headers(): Record<string, string> {
  const key = process.env.RUNWAYML_API_KEY;
  if (!key) throw new Error('RUNWAYML_API_KEY is not configured');
  return {
    'Content-Type':    'application/json',
    'Authorization':   `Bearer ${key}`,
    'X-Runway-Version': '2024-11-06',
  };
}

async function runwayFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res  = await fetch(`${RUNWAY_API_BASE}${path}`, { ...init, headers: headers() });
  const body = await res.json() as T & { error?: string; message?: string };
  if (!res.ok) {
    const msg = (body as { error?: string; message?: string }).error
             ?? (body as { error?: string; message?: string }).message
             ?? res.statusText;
    throw new Error(`RunwayML error: ${msg}`);
  }
  return body;
}

// ─── Start a generation task ─────────────────────────────────────────────────

export async function createRunwayTask(params: RunwayGenerateParams): Promise<RunwayTask> {
  const body: Record<string, unknown> = {
    model:       RUNWAY_MODEL,
    promptText:  params.promptText,
    ratio:       params.aspectRatio ?? '768:1280',    // vertical 9:16 for Reels
    duration:    params.duration    ?? 5,
  };

  if (params.promptImage) body.promptImage = params.promptImage;
  if (params.seed)        body.seed        = params.seed;

  return runwayFetch<RunwayTask>('/image_to_video', {
    method: 'POST',
    body:   JSON.stringify(body),
  });
}

// ─── Poll task status ─────────────────────────────────────────────────────────

export async function getRunwayTask(taskId: string): Promise<RunwayTask> {
  return runwayFetch<RunwayTask>(`/tasks/${taskId}`);
}

// ─── Wait for completion (polls every 4 s, max 3 min) ────────────────────────

export async function waitForRunwayTask(taskId: string): Promise<string> {
  for (let i = 0; i < 45; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    const task = await getRunwayTask(taskId);

    if (task.status === 'SUCCEEDED') {
      const url = task.output?.[0];
      if (!url) throw new Error('RunwayML task succeeded but no output URL');
      return url;
    }
    if (task.status === 'FAILED' || task.status === 'CANCELLED') {
      throw new Error(`RunwayML task ${task.status.toLowerCase()}: ${task.failure ?? 'unknown reason'}`);
    }
  }
  throw new Error('RunwayML task timed out after 3 minutes');
}

// ─── Convenience: generate + wait ────────────────────────────────────────────

export async function generateVideo(params: RunwayGenerateParams): Promise<{ videoUrl: string; taskId: string }> {
  const task    = await createRunwayTask(params);
  const videoUrl = await waitForRunwayTask(task.id);
  return { videoUrl, taskId: task.id };
}
