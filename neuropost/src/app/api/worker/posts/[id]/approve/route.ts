import { NextResponse }                        from 'next/server';
import type { NextRequest }                    from 'next/server';
import { requireWorker, workerErrorResponse }  from '@/lib/worker';
import { createAdminClient }                   from '@/lib/supabase';
import { triggerPostNotification }             from '@/lib/notifications/trigger-post-notification';

// POST /api/worker/posts/[id]/approve
// Promotes a specific revision to client review:
//   posts.status           → 'client_review'
//   posts.edited_image_url → revision.image_url
// Notifies the client only on the FIRST successful approval (no prior revisions
// with image_url). Retries/re-approvals after an existing result don't re-notify.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireWorker();
    const { id } = await ctx.params;
    const { revision_id } = await req.json() as { revision_id: string };

    if (!revision_id)
      return NextResponse.json({ error: 'revision_id is required' }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createAdminClient() as any;

    const { data: revision, error: revErr } = await db
      .from('post_revisions')
      .select('id, post_id, image_url')
      .eq('id', revision_id)
      .eq('post_id', id)
      .single();

    if (revErr || !revision)
      return NextResponse.json({ error: 'Revision not found for this post' }, { status: 404 });

    if (!revision.image_url)
      return NextResponse.json({ error: 'Revision has no image yet — wait for generation to complete' }, { status: 422 });

    // Count prior revisions with images (excluding the one being approved).
    // If any exist, the client already saw a result — skip notification.
    const { count: priorCount } = await db
      .from('post_revisions')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', id)
      .not('image_url', 'is', null)
      .neq('id', revision_id);

    const isFirstResult = (priorCount ?? 0) === 0;

    const { data: post, error: updateErr } = await db
      .from('posts')
      .update({
        status:           'client_review',
        edited_image_url: revision.image_url,
      })
      .eq('id', id)
      .select('id, brand_id, format')
      .single();

    if (updateErr) throw updateErr;

    if (isFirstResult) {
      // Fire-and-forget — never let notification failure break the approve response
      void triggerPostNotification('post.ready_for_review', {
        postId:   post.id,
        brandId:  post.brand_id,
        format:   post.format ?? null,
        imageUrl: revision.image_url,
      });
    }

    return NextResponse.json({ post });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
