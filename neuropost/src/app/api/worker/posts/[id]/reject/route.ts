import { NextResponse }                        from 'next/server';
import type { NextRequest }                    from 'next/server';
import { requireWorker, workerErrorResponse }  from '@/lib/worker';
import { createAdminClient }                   from '@/lib/supabase';
import { triggerPostNotification }             from '@/lib/notifications/trigger-post-notification';

// POST /api/worker/posts/[id]/reject
// Marks a post as rejected and records the worker's reason.
// Always notifies the client (they need to know, regardless of prior rejections).
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireWorker();
    const { id } = await ctx.params;
    const { reason } = await req.json() as { reason: string };

    if (!reason || reason.trim().length < 10)
      return NextResponse.json({ error: 'reason must be at least 10 characters' }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createAdminClient() as any;

    const { data: post, error } = await db
      .from('posts')
      .update({ status: 'rejected', worker_notes: reason.trim() })
      .eq('id', id)
      .select('id, brand_id, format')
      .single();

    if (error) throw error;

    void triggerPostNotification('post.rejected', {
      postId:  post.id,
      brandId: post.brand_id,
      format:  post.format ?? null,
      reason:  reason.trim(),
    });

    return NextResponse.json({ post });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
