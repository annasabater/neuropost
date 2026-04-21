import { NextResponse }                        from 'next/server';
import type { NextRequest }                    from 'next/server';
import { requireWorker, workerErrorResponse }  from '@/lib/worker';
import { createAdminClient }                   from '@/lib/supabase';

export const maxDuration = 60;

// POST /api/worker/posts/[id]/manual-upload  (multipart/form-data, field: "image")
// Worker uploads an externally-edited image. Creates a revision with
// model='manual_upload' and sets posts.edited_image_url to the new URL.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const worker = await requireWorker();
    const { id } = await ctx.params;

    const formData = await req.formData();
    const file = formData.get('image') as File | null;

    if (!file)
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    if (!file.type.startsWith('image/'))
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    if (file.size > 10 * 1024 * 1024)
      return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createAdminClient() as any;

    const { data: post, error: postErr } = await db
      .from('posts')
      .select('id, brand_id')
      .eq('id', id)
      .single();

    if (postErr || !post)
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    // Upload to assets bucket
    const ext      = file.name.split('.').pop() ?? 'jpg';
    const path     = `manual/${id}/${Date.now()}.${ext}`;
    const buffer   = await file.arrayBuffer();

    const { error: upErr } = await db.storage
      .from('assets')
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

    const { data: { publicUrl } } = db.storage.from('assets').getPublicUrl(path);

    // Next revision_index
    const { data: maxRow } = await db
      .from('post_revisions')
      .select('revision_index')
      .eq('post_id', id)
      .order('revision_index', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextIndex = (maxRow?.revision_index ?? -1) + 1;

    const { data: revision, error: revErr } = await db
      .from('post_revisions')
      .insert({
        post_id:          id,
        brand_id:         post.brand_id,
        revision_index:   nextIndex,
        prompt:           null,
        model:            'manual_upload',
        image_url:        publicUrl,
        cost_usd:         0,
        duration_seconds: 0,
        triggered_by:     'worker',
        worker_id:        worker.id,
      })
      .select('*')
      .single();

    if (revErr) throw revErr;

    await db.from('posts').update({ edited_image_url: publicUrl }).eq('id', id);

    return NextResponse.json({ revision }, { status: 201 });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
