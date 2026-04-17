import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

/**
 * POST /api/worker/jobs/:id/complete
 * Complete a claimed job manually. The worker provides the output
 * (image_url, video_url, caption, etc.) and the job is finalized.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const worker = await requireWorker();
    const { id: jobId } = await ctx.params;
    const db: DB = createAdminClient();
    const body = await req.json().catch(() => ({}));

    // Verify the job is claimed by this worker
    const { data: job } = await db
      .from('agent_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('status', 'claimed')
      .eq('claimed_by', worker.id)
      .maybeSingle();

    if (!job) {
      return NextResponse.json(
        { error: 'Job no encontrado o no reclamado por ti' },
        { status: 404 },
      );
    }

    // Save manual output
    const output = {
      kind:        body.kind ?? 'image',
      payload:     body.payload ?? {},
      preview_url: body.image_url ?? body.video_url ?? null,
      model:       'manual',
    };

    await db.from('agent_outputs').insert({
      job_id:      jobId,
      brand_id:    job.brand_id,
      kind:        output.kind,
      payload:     output.payload,
      preview_url: output.preview_url,
      model:       'manual',
    });

    // If a post_id was in the job input, update the post
    const postId = (job.input as Record<string, unknown>)?._post_id as string | undefined;
    if (postId) {
      const postUpdate: Record<string, unknown> = { status: 'pending' };
      if (body.image_url) postUpdate.edited_image_url = body.image_url;
      if (body.video_url) postUpdate.video_url = body.video_url;
      if (body.caption) postUpdate.caption = body.caption;
      if (body.hashtags) postUpdate.hashtags = body.hashtags;
      await db.from('posts').update(postUpdate).eq('id', postId);
    }

    // Finalize the job
    await db.from('agent_jobs').update({
      status:      'done',
      finished_at: new Date().toISOString(),
      error:       null,
    }).eq('id', jobId);

    // Notify
    if (job.brand_id) {
      await db.from('notifications').insert({
        brand_id: job.brand_id,
        type:     'approval_needed',
        message:  'Tu contenido está listo para revisar',
        read:     false,
        metadata: { job_id: jobId, post_id: postId ?? null, completed_by: 'worker' },
      }).then(() => null);
    }

    return NextResponse.json({ ok: true, job_id: jobId });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
