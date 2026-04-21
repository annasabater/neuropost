import { NextResponse }                        from 'next/server';
import type { NextRequest }                    from 'next/server';
import { requireWorker, workerErrorResponse }  from '@/lib/worker';
import { createAdminClient }                   from '@/lib/supabase';
import { triggerPostNotification }             from '@/lib/notifications/trigger-post-notification';

// POST /api/worker/posts/[id]/reanalyze
// Re-runs VisualStrategistAgent with an optional worker feedback note injected
// into the brief. Overwrites posts.agent_brief with the new output.
// Also used for legacy posts with no brief (worker_feedback can be empty string).
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireWorker();
    const { id } = await ctx.params;
    const { worker_feedback } = await req.json() as { worker_feedback: string };

    if (typeof worker_feedback !== 'string')
      return NextResponse.json({ error: 'worker_feedback must be a string' }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createAdminClient() as any;

    // Load post + brand
    const { data: post, error: postErr } = await db
      .from('posts')
      .select('id, brand_id, image_url, format, caption, ai_explanation, agent_brief')
      .eq('id', id)
      .single();

    if (postErr || !post)
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    const { data: brand } = await db
      .from('brands')
      .select('name, sector, visual_style, brand_voice_doc, tone, colors, rules')
      .eq('id', post.brand_id)
      .single();

    // Parse ai_explanation for client context
    let clientDesc = post.caption ?? '';
    let sourceImageUrl: string | null = post.image_url ?? null;
    let inspirationIds: string[] = [];
    let sourceFiles: string[] = [];

    try {
      const meta = JSON.parse(post.ai_explanation ?? '{}') as Record<string, unknown>;
      const perImg = meta.per_image as Array<{ note?: string; media_url?: string; inspiration_id?: string }> | undefined;
      clientDesc = perImg?.[0]?.note?.trim()
        || String(meta.global_description ?? meta.client_notes ?? post.caption ?? '');
      sourceFiles = Array.isArray(meta.source_files) ? (meta.source_files as string[]) : [];
      inspirationIds = (meta.global_inspiration_ids as string[] | null) ?? [];
      if (sourceFiles.length) sourceImageUrl = sourceFiles[0];
    } catch { /* use defaults */ }

    // Resolve inspiration thumbnails if any
    const inspirations: Array<{ id: string; thumbnail_url: string }> = [];
    if (inspirationIds.length) {
      const { data: refs } = await db
        .from('inspiration_references')
        .select('id, image_url')
        .in('id', inspirationIds);
      for (const r of refs ?? []) {
        if (r.image_url) inspirations.push({ id: r.id, thumbnail_url: r.image_url });
      }
      if (inspirations.length < inspirationIds.length) {
        const foundIds = inspirations.map(i => i.id);
        const missing  = inspirationIds.filter(i => !foundIds.includes(i));
        const { data: bankRefs } = await db
          .from('inspiration_bank')
          .select('id, thumbnail_url')
          .in('id', missing);
        for (const r of bankRefs ?? []) {
          if (r.thumbnail_url) inspirations.push({ id: r.id, thumbnail_url: r.thumbnail_url });
        }
      }
    }

    // Inject worker feedback into the description
    const enrichedDesc = worker_feedback.trim()
      ? `${clientDesc}\n\n[Worker feedback]: ${worker_feedback.trim()}`
      : clientDesc;

    const postFormat = post.format === 'story' ? 'story'
                     : post.format === 'reel'  ? 'reel_cover' : 'post';

    const { runVisualStrategist, fallbackBrief } = await import('@/agents/VisualStrategistAgent');

    let brief: Awaited<ReturnType<typeof runVisualStrategist>>;
    try {
      brief = await runVisualStrategist({
        clientDescription: enrichedDesc,
        brandContext:      brand?.brand_voice_doc
          ?? `${brand?.name ?? 'marca'} — sector ${brand?.sector ?? 'otro'}, tono ${brand?.tone ?? 'cercano'}`,
        sector:      (brand?.sector       ?? 'restaurante') as import('@/types').SocialSector,
        visualStyle: (brand?.visual_style ?? 'warm')        as import('@/types').VisualStyle,
        colors:      brand?.colors ?? null,
        forbiddenWords: (brand?.rules as { forbiddenWords?: string[] } | null)?.forbiddenWords ?? [],
        format:          postFormat,
        sourceImages:    sourceFiles.length ? sourceFiles : (sourceImageUrl ? [sourceImageUrl] : []),
        inspirations,
      });
    } catch {
      brief = fallbackBrief({
        clientDescription: enrichedDesc,
        brandContext:      brand?.brand_voice_doc ?? `${brand?.name} — sector ${brand?.sector}`,
        sector:      (brand?.sector       ?? 'restaurante') as import('@/types').SocialSector,
        visualStyle: (brand?.visual_style ?? 'warm')        as import('@/types').VisualStyle,
        format:          postFormat,
        sourceImages:    sourceFiles.length ? sourceFiles : (sourceImageUrl ? [sourceImageUrl] : []),
        inspirations,
      });
    }

    const { data: updatedPost } = await db.from('posts')
      .update({
        agent_brief:              brief,
        agent_brief_generated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, brand_id, format')
      .single();

    if (updatedPost) {
      void triggerPostNotification('post.reanalysis_done', {
        postId:  updatedPost.id,
        brandId: updatedPost.brand_id,
        format:  updatedPost.format ?? null,
      });
    }

    return NextResponse.json({ brief });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
