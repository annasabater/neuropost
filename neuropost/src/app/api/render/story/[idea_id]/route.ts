// =============================================================================
// POST /api/render/story/[idea_id]
// =============================================================================
// Renders a story content_idea as a 1080×1920 PNG and uploads it to Supabase
// Storage (`stories-rendered` bucket). Updates content_ideas.rendered_image_url
// on success or render_error on failure.
//
// Called non-blocking (fire-and-forget) from plan-week.ts after story insertion.
// Also callable manually from the plan review UI for re-renders.

import { NextResponse }     from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { renderStory }       from '@/lib/stories/render';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ idea_id: string }> },
) {
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
    // 2. Render PNG
    const buffer = await renderStory({ layoutName, idea, brand });

    // 3. Upload to Supabase Storage
    const path = `${brand.id}/${idea_id}.png`;
    const { error: uploadErr } = await db.storage
      .from('stories-rendered')
      .upload(path, buffer, { contentType: 'image/png', upsert: true });

    if (uploadErr) throw new Error(`storage upload: ${uploadErr.message}`);

    // 4. Get public URL
    const { data: urlData } = db.storage
      .from('stories-rendered')
      .getPublicUrl(path);

    const publicUrl: string = urlData.publicUrl;

    // 5. Update idea with rendered URL
    await db
      .from('content_ideas')
      .update({ rendered_image_url: publicUrl, render_error: null })
      .eq('id', idea_id);

    return NextResponse.json({ rendered_image_url: publicUrl }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[render/story/${idea_id}]`, message);

    // Save error to DB so UI can surface it
    await db
      .from('content_ideas')
      .update({ render_error: message })
      .eq('id', idea_id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
