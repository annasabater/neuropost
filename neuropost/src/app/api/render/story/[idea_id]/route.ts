// =============================================================================
// POST /api/render/story/[idea_id]
// =============================================================================
// Renders a story content_idea as a 1080×1920 PNG and uploads it to Supabase
// Storage (`stories-rendered` bucket). Updates content_ideas.rendered_image_url
// on success or render_error on failure.
//
// Called non-blocking (fire-and-forget) from plan-week.ts after story insertion.
// Also callable manually from the plan review UI for re-renders.
//
// If idea.hook starts with "REPLICATE:{prompt}", generates the background image
// synchronously (polling, max 90s) before rendering.

import { NextResponse }      from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { renderStory }       from '@/lib/stories/render';
import { log }               from '@/lib/logger';
import * as Sentry           from '@sentry/nextjs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

// ─── Replicate sync helper ────────────────────────────────────────────────────

const REPLICATE_POLL_INTERVAL_MS = 3_000;
const REPLICATE_MAX_POLLS        = 30;   // 90 s max

interface ReplicateOutput {
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[] | null;
  error?:  string | null;
}

async function generateImageSync(prompt: string): Promise<string> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN not configured');

  // Create prediction without webhook for synchronous polling
  const createRes = await fetch(
    'https://api.replicate.com/v1/models/black-forest-labs/flux-dev/predictions',
    {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        input: {
          prompt,
          width:               1080,
          height:              1920,
          output_format:       'jpg',
          num_outputs:         1,
          num_inference_steps: 28,
          guidance_scale:      3.5,
        },
      }),
    },
  );

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({})) as { detail?: string };
    throw new Error(`Replicate create failed: ${err.detail ?? createRes.statusText}`);
  }

  const prediction = await createRes.json() as ReplicateOutput & { id: string; urls: { get: string } };
  const pollUrl    = prediction.urls.get;

  for (let i = 0; i < REPLICATE_MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, REPLICATE_POLL_INTERVAL_MS));

    const pollRes = await fetch(pollUrl, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!pollRes.ok) continue;

    const status = await pollRes.json() as ReplicateOutput;

    if (status.status === 'succeeded') {
      const out = Array.isArray(status.output) ? status.output[0] : status.output;
      if (!out) throw new Error('Replicate succeeded but output is empty');
      return out;
    }

    if (status.status === 'failed' || status.status === 'canceled') {
      throw new Error(`Replicate prediction ${status.status}: ${status.error ?? 'unknown'}`);
    }
  }

  throw new Error('Replicate prediction timed out after 90s');
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ idea_id: string }> },
) {
  // Soft auth: enforced only when INTERNAL_RENDER_TOKEN is configured
  const renderToken = process.env.INTERNAL_RENDER_TOKEN;
  if (renderToken) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${renderToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const { idea_id } = await params;
  const db = createAdminClient() as DB;

  // 1. Load idea
  const { data: idea, error: ideaErr } = await db
    .from('content_ideas')
    .select('*')
    .eq('id', idea_id)
    .single();

  if (ideaErr || !idea) {
    return NextResponse.json({ error: 'Idea not found' }, { status: 404 });
  }

  if (idea.content_kind !== 'story') {
    return NextResponse.json({ error: 'Idea is not a story' }, { status: 400 });
  }

  if (!idea.template_id || !idea.brand_id) {
    return NextResponse.json({ error: 'Missing template or brand' }, { status: 422 });
  }

  // P1: idempotency — already rendered, nothing to do
  if (idea.render_status === 'rendered') {
    return NextResponse.json({ rendered_image_url: idea.rendered_image_url }, { status: 200 });
  }

  // P1: atomic claim — skip if another worker already claimed this render
  const { data: claimed } = await db
    .from('content_ideas')
    .update({ render_status: 'rendering', render_started_at: new Date().toISOString() })
    .eq('id', idea_id)
    .in('render_status', ['pending_render', 'render_failed'])
    .select('id');

  if (!claimed || claimed.length === 0) {
    // Already being rendered by a concurrent request
    return NextResponse.json({ error: 'Render already in progress' }, { status: 409 });
  }
  log({ level: 'info', scope: 'render/story', event: 'render_claimed', idea_id });

  // 2. Load template + brand separately (template_id has no FK constraint, can't use PostgREST join)
  const [{ data: template }, { data: brand }] = await Promise.all([
    db.from('story_templates').select('*').eq('id', idea.template_id).single(),
    db.from('brands').select('*').eq('id', idea.brand_id).single(),
  ]);

  if (!template || !brand) {
    return NextResponse.json({ error: 'Missing template or brand' }, { status: 422 });
  }

  const layoutName: string = template.layout_config?.layout ?? 'flexible';

  try {
    // 2a. If an image prompt is available, generate the background image via Replicate first.
    // P17: read image_generation_prompt (new column); fall back to hook REPLICATE: prefix for
    // rows created before the P17 migration. Remove the hook fallback after one release cycle.
    let bgImageUrl: string | null = idea.suggested_asset_url ?? null;

    const imageGenPrompt: string | null = idea.image_generation_prompt ?? null;
    // DEPRECATED: hook REPLICATE: encoding — kept for pre-P17 rows; remove after migration verified
    const hook = typeof idea.hook === 'string' ? idea.hook : null;
    const replicatePrompt = imageGenPrompt ?? (hook?.startsWith('REPLICATE:') ? hook.slice('REPLICATE:'.length).trim() : null);

    if (replicatePrompt) {
      const imagePrompt = replicatePrompt;
      console.log(`[render/story/${idea_id}] Generating Replicate bg image…`);

      const replicateUrl = await generateImageSync(imagePrompt);

      // Download the generated image and re-upload to persistent storage
      const imgRes = await fetch(replicateUrl);
      if (!imgRes.ok) throw new Error(`Failed to download Replicate image: ${imgRes.status}`);
      const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

      const bgPath = `${brand.id}/${idea_id}-bg.jpg`;
      const { error: bgUploadErr } = await db.storage
        .from('stories-rendered')
        .upload(bgPath, imgBuffer, { contentType: 'image/jpeg', upsert: true });

      if (bgUploadErr) throw new Error(`bg upload: ${bgUploadErr.message}`);

      const { data: bgUrlData } = db.storage.from('stories-rendered').getPublicUrl(bgPath);
      bgImageUrl = bgUrlData.publicUrl as string;

      // Persist to DB so future re-renders skip Replicate
      await db
        .from('content_ideas')
        .update({ suggested_asset_url: bgImageUrl })
        .eq('id', idea_id);
    }

    // 3. Render PNG
    const buffer = await renderStory({ layoutName, idea, brand, bgImageUrl: bgImageUrl ?? undefined });

    // 4. Upload to Supabase Storage
    const path = `${brand.id}/${idea_id}.png`;
    const { error: uploadErr } = await db.storage
      .from('stories-rendered')
      .upload(path, buffer, { contentType: 'image/png', upsert: true });

    if (uploadErr) throw new Error(`storage upload: ${uploadErr.message}`);

    // 5. Get public URL
    const { data: urlData } = db.storage
      .from('stories-rendered')
      .getPublicUrl(path);

    const publicUrl: string = urlData.publicUrl;

    // 6. Update idea with rendered URL + mark complete
    await db
      .from('content_ideas')
      .update({
        rendered_image_url:  publicUrl,
        render_error:        null,
        render_status:       'rendered',
        render_completed_at: new Date().toISOString(),
      })
      .eq('id', idea_id);

    log({ level: 'info', scope: 'render/story', event: 'render_complete', idea_id });
    return NextResponse.json({ rendered_image_url: publicUrl }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log({ level: 'error', scope: 'render/story', event: 'render_failed', idea_id, error: message });
    Sentry.captureException(err, { tags: { component: 'render-story' }, extra: { idea_id } });

    await db
      .from('content_ideas')
      .update({ render_error: message, render_status: 'render_failed' })
      .eq('id', idea_id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
