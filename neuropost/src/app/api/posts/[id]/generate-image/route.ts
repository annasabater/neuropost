// =============================================================================
// POST /api/posts/[id]/generate-image
// Worker triggers AI image generation for a pending post.
//
// Queues N agent jobs (content:generate_image) — one per photo requested.
// Each job, once done, auto-queues content:validate_image.
// When all photos pass validation they land in posts.generated_images[].
// The client is notified automatically when the batch is complete.
//
// Body (optional): { inspiration_id?: string }
// =============================================================================

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { createAdminClient }  from '@/lib/supabase';
import { requireWorker }       from '@/lib/worker';
import { queueJob }            from '@/lib/agents/queue';
import type { Brand, Post }    from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireWorker();
    const { id: postId } = await params;
    const db = createAdminClient() as DB;

    // ── 1. Load post ──────────────────────────────────────────────────────────
    const { data: post, error: postErr } = await db
      .from('posts').select('*').eq('id', postId).single();
    if (postErr || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    const p = post as Post;

    // ── 2. Load brand kit ──────────────────────────────────────────────────────
    const { data: brand } = await db
      .from('brands')
      .select('name, sector, tone, visual_style, brand_voice_doc, colors, rules')
      .eq('id', p.brand_id)
      .single();
    const b = brand as Brand | null;

    // ── 3. Optional inspiration reference ─────────────────────────────────────
    let inspirationPrompt = '';
    const body = await request.json().catch(() => ({})) as { inspiration_id?: string };
    if (body.inspiration_id) {
      const { data: ref } = await db
        .from('inspiration_references')
        .select('title, notes, style_tags, format')
        .eq('id', body.inspiration_id)
        .single();
      if (ref) {
        const parts = [`Inspired by: "${ref.title}"`];
        if (ref.notes)              parts.push(ref.notes);
        if (ref.style_tags?.length) parts.push(`style: ${(ref.style_tags as string[]).join(', ')}`);
        if (ref.format)             parts.push(`format: ${ref.format}`);
        inspirationPrompt = parts.join(', ');
      }
    }

    // ── 4. Extract client description from ai_explanation ─────────────────────
    let clientDesc = '';
    try {
      const parsed = JSON.parse(p.ai_explanation ?? '{}') as Record<string, string>;
      clientDesc = parsed.client_notes ?? parsed.caption ?? parsed.description ?? '';
    } catch {
      clientDesc = p.ai_explanation ?? '';
    }

    const basePrompt = [inspirationPrompt, clientDesc]
      .filter(Boolean).join('. ');

    // ── 5. Queue one generate_image job per photo requested ───────────────────
    const photoCount = Math.max(1, p.photo_count ?? 1);

    // Mark post as being generated
    await db.from('posts').update({
      status:           'pending',
      generation_total: photoCount,
      generation_done:  0,
      generated_images: [],
    }).eq('id', postId);

    const jobs = await Promise.all(
      Array.from({ length: photoCount }, (_, i) =>
        queueJob({
          brand_id:   p.brand_id,
          agent_type: 'content',
          action:     'generate_image',
          input: {
            userPrompt:   basePrompt || `Contenido para ${b?.name ?? 'negocio'}, sector ${b?.sector ?? 'local'}`,
            sector:       b?.sector   ?? 'restaurante',
            visualStyle:  b?.visual_style ?? 'warm',
            brandContext: b?.brand_voice_doc
              ?? `${b?.name ?? ''} — sector ${b?.sector ?? ''}, tono ${b?.tone ?? 'cercano'}`,
            colors:        b?.colors   ?? null,
            forbiddenWords: (b?.rules as { forbiddenWords?: string[] } | null)?.forbiddenWords ?? [],
            noEmojis:      (b?.visual_style === 'elegant' || b?.visual_style === 'dark'),
            format:        p.format === 'story' ? 'story' : p.format === 'reel' ? 'reel_cover' : 'post',
            brandId:       p.brand_id,
            // Metadata for post-generation pipeline
            _post_id:      postId,
            _photo_index:  i,
            _original_prompt: basePrompt,
          },
          priority:     70,
          requested_by: 'worker',
        }),
      ),
    );

    return NextResponse.json({
      ok:         true,
      photo_count: photoCount,
      job_ids:    jobs.map((j) => j.id),
    });
  } catch (err) {
    console.error('[generate-image]', err);
    return apiError(err, 'posts/[id]/generate-image');
  }
}
