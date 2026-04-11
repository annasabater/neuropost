import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

// PATCH /api/worker/posts/[id]
// Worker responds to a client request post with new content (image + caption).
// Transitions the post from 'request' → 'pending' and notifies the client.
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireWorker();
    const { id } = await ctx.params;
    const db = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = await req.json() as Record<string, any>;

    // Fetch the existing post to verify it exists + get brand_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing, error: fetchErr } = await (db as any)
      .from('posts')
      .select('id, brand_id, ai_explanation, image_url, status')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Preserve original client metadata, merge worker response
    const origExpl: Record<string, unknown> = (() => {
      if (!existing.ai_explanation) return {};
      try { return JSON.parse(existing.ai_explanation); } catch { return {}; }
    })();

    const mergedExpl = JSON.stringify({
      ...origExpl,
      from_worker: true,
      original_image_url: origExpl.original_image_url ?? existing.image_url ?? null,
      worker_caption: body.caption ?? null,
      worker_notes: body.worker_notes ?? null,
    });

    const newStatus = body.status ?? 'pending';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updated, error } = await (db as any)
      .from('posts')
      .update({
        ...(body.image_url !== undefined ? { image_url: body.image_url } : {}),
        ...(body.caption !== undefined ? { caption: body.caption } : {}),
        ...(body.hashtags !== undefined ? { hashtags: body.hashtags } : {}),
        ...(body.format !== undefined ? { format: body.format } : {}),
        status: newStatus,
        ai_explanation: mergedExpl,
        ...(body.agent_id !== undefined ? { agent_id: body.agent_id ?? null } : {}),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Notify client when content moves to pending
    if (newStatus === 'pending') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as any).from('notifications').insert({
          brand_id: existing.brand_id,
          type: 'content_ready',
          message: 'Tu contenido ya está listo — revisa la propuesta de tu equipo.',
          read: false,
          metadata: { postId: id },
        });
      } catch (notifErr) {
        console.error('[worker/posts/[id]] Failed to insert notification:', notifErr);
      }
    }

    return NextResponse.json({ post: updated });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
