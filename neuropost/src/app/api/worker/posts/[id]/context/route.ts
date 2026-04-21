import { NextResponse }                       from 'next/server';
import type { NextRequest }                   from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient }                  from '@/lib/supabase';

// GET /api/worker/posts/[id]/context
// Returns inspirations resolved for the cockpit ClientRequestPanel.
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireWorker();
    const { id } = await ctx.params;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createAdminClient() as any;

    const { data: post, error: postErr } = await db
      .from('posts')
      .select('id, ai_explanation')
      .eq('id', id)
      .single();

    if (postErr || !post)
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    // Parse inspiration IDs
    let inspirationIds: string[] = [];
    try {
      const meta = JSON.parse(post.ai_explanation ?? '{}') as Record<string, unknown>;
      inspirationIds = (meta.global_inspiration_ids as string[] | null) ?? [];
    } catch { /* none */ }

    const inspirations: Array<{ id: string; thumbnail_url: string }> = [];

    if (inspirationIds.length) {
      const { data: refs } = await db
        .from('inspiration_references')
        .select('id, image_url')
        .in('id', inspirationIds);

      for (const r of refs ?? []) {
        if (r.image_url) inspirations.push({ id: r.id, thumbnail_url: r.image_url });
      }

      const foundIds = inspirations.map((i) => i.id);
      const missing  = inspirationIds.filter((i) => !foundIds.includes(i));

      if (missing.length) {
        const { data: bankRefs } = await db
          .from('inspiration_bank')
          .select('id, thumbnail_url')
          .in('id', missing);
        for (const r of bankRefs ?? []) {
          if (r.thumbnail_url) inspirations.push({ id: r.id, thumbnail_url: r.thumbnail_url });
        }
      }
    }

    return NextResponse.json({ inspirations });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
