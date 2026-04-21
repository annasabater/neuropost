import { NextResponse }                        from 'next/server';
import type { NextRequest }                    from 'next/server';
import { requireWorker, workerErrorResponse }  from '@/lib/worker';
import { createAdminClient }                   from '@/lib/supabase';
import { queueJob }                            from '@/lib/agents/queue';

// POST /api/worker/posts/[id]/regenerate
// Worker edits the agent brief fields and triggers a new generation.
// Creates a post_revisions placeholder row (image_url = null), enqueues the
// job with _revision_id so the handler fills in the result when done.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const worker = await requireWorker();
    const { id } = await ctx.params;

    const body = await req.json() as {
      prompt:            string;
      negative_prompt?:  string;
      edit_strength:     number;
      guidance:          number;
      num_outputs:       number;
      model:             'flux-pro' | 'flux-kontext-pro' | 'higgsfield' | 'nanobanana';
      primary_image_url: string | null;
    };

    if (!body.prompt?.trim())
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    if (body.edit_strength < 0 || body.edit_strength > 1)
      return NextResponse.json({ error: 'edit_strength must be 0–1' }, { status: 400 });
    if (body.guidance < 1 || body.guidance > 10)
      return NextResponse.json({ error: 'guidance must be 1–10' }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createAdminClient() as any;

    const { data: post, error: postErr } = await db
      .from('posts')
      .select('id, brand_id, agent_brief')
      .eq('id', id)
      .single();

    if (postErr || !post)
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    // Next revision_index
    const { data: maxRow } = await db
      .from('post_revisions')
      .select('revision_index')
      .eq('post_id', id)
      .order('revision_index', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextIndex = (maxRow?.revision_index ?? -1) + 1;

    // Insert placeholder revision (image_url filled when job completes)
    const { data: revision, error: revErr } = await db
      .from('post_revisions')
      .insert({
        post_id:         id,
        brand_id:        post.brand_id,
        revision_index:  nextIndex,
        prompt:          body.prompt,
        negative_prompt: body.negative_prompt ?? null,
        model:           body.model,
        strength:        body.edit_strength,
        guidance:        body.guidance,
        num_outputs:     body.num_outputs,
        triggered_by:    'worker',
        worker_id:       worker.id,
        image_url:       null,
      })
      .select('*')
      .single();

    if (revErr || !revision) throw revErr ?? new Error('Failed to create revision');

    // Reconstruct brief from the worker's edits, merging over original brief
    const agentBrief = {
      ...(post.agent_brief ?? {}),
      generation_prompt: body.prompt,
      guidance:          body.guidance,
      strength:          body.edit_strength,
      model:             body.model,
      primary_image_url: body.primary_image_url,
      mode:              body.primary_image_url ? 'img2img' : 'txt2img',
    };

    const job = await queueJob({
      brand_id:    post.brand_id,
      agent_type:  'content',
      action:      'generate_image',
      input: {
        userPrompt:        body.prompt,
        brandId:           post.brand_id,
        _post_id:          id,
        _revision_id:      revision.id,
        _agent_brief:      agentBrief,
        _auto_pipeline:    false,
        referenceImageUrl: body.primary_image_url ?? undefined,
        editStrength:      body.edit_strength,
        guidance:          body.guidance,
      },
      priority:     90,
      requested_by: 'worker',
    });

    return NextResponse.json({ revision, job_id: job.id }, { status: 201 });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
