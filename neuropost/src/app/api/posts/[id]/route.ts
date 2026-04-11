import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient, createAdminClient } from '@/lib/supabase';
import { requirePermission } from '@/lib/rbac';
import { syncPostIntoFeedQueue } from '@/lib/feedQueue';
import type { Post } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id }   = await params;
    const user     = await requireServerUser();
    const supabase = await createServerClient() as DB;

    const { data: brand } = await supabase.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { data, error } = await supabase
      .from('posts').select('*').eq('id', id).eq('brand_id', brand.id).single();
    if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ post: data as Post });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id }   = await params;
    const user     = await requireServerUser();
    const body     = await request.json() as Record<string, unknown>;
    const supabase = await createServerClient() as DB;

    const { data: brand } = await supabase.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const patchAction = (body.status === 'approved' || body.status === 'rejected')
      ? 'approve_post'
      : 'edit_post';
    const permErr = await requirePermission(user.id, brand.id, patchAction);
    if (permErr) return permErr;

    // If approving the post, record who approved it
    const updatePayload = body.status === 'approved'
      ? { ...body, approved_by: user.id }
      : body;

    // Fetch current status before updating so we can detect the request→pending transition.
    const { data: current } = await supabase
      .from('posts').select('status').eq('id', id).eq('brand_id', brand.id).single();

    const { data, error } = await supabase
      .from('posts').update(updatePayload).eq('id', id).eq('brand_id', brand.id).select().single();
    if (error) throw error;
    await syncPostIntoFeedQueue(createAdminClient(), data as Post);

    // Notify brand when content transitions to pending (worker processed it).
    if (body.status === 'pending' && current?.status === 'request') {
      try {
        await supabase.from('notifications').insert({
          brand_id: brand.id,
          type:     'content_ready',
          message:  'Tu contenido ya está listo — revisa la propuesta de tu equipo.',
          read:     false,
          metadata: { postId: id },
        });
      } catch { /* non-blocking */ }
    }

    return NextResponse.json({ post: data as Post });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id }   = await params;
    const user     = await requireServerUser();
    const supabase = await createServerClient() as DB;
    const adminDb  = createAdminClient() as DB;

    const { data: brand } = await supabase.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    // Best-effort cleanup of every child row referencing this post.
    // We log failures but never abort the deletion — what matters is that
    // `posts.delete()` succeeds at the end. Some tables may not exist (42P01),
    // some may not have a `brand_id` column in older envs (42703), some may
    // have RLS quirks — none of those should block the user from deleting.
    const cleanupByPost = async (table: string) => {
      try {
        // Try with brand_id first (extra safety on shared envs).
        let res = await adminDb.from(table).delete().eq('post_id', id).eq('brand_id', brand.id);
        if (res.error && (res.error.code === '42703' /* undefined column */)) {
          // Fall back: brand_id column doesn't exist on this table → delete by post_id only.
          res = await adminDb.from(table).delete().eq('post_id', id);
        }
        if (res.error && res.error.code !== '42P01' /* undefined table */) {
          console.warn(`[DELETE /api/posts/${id}] cleanup ${table} failed`, res.error);
        }
      } catch (e) {
        console.warn(`[DELETE /api/posts/${id}] cleanup ${table} threw`, e);
      }
    };

    // Tables with FK → posts(id) that DON'T have ON DELETE CASCADE.
    // (recreation_requests, brand_trends, feed_queue all need explicit cleanup.)
    await cleanupByPost('recreation_requests');
    await cleanupByPost('brand_trends');
    await cleanupByPost('feed_queue');
    // Tables that DO cascade — cleaned up just for completeness, harmless if missing.
    await cleanupByPost('content_queue');
    await cleanupByPost('generated_assets');

    const { error } = await adminDb.from('posts').delete().eq('id', id).eq('brand_id', brand.id);
    if (error) {
      console.error(`[DELETE /api/posts/${id}] final delete failed`, error);
      return NextResponse.json({
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('[DELETE /api/posts/[id]]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
