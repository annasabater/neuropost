import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
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
    return apiError(err, 'posts/[id]');
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

    return NextResponse.json({ post: data as Post });
  } catch (err) {
    return apiError(err, 'posts/[id]');
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
    // Errors that mean "this table/column isn't in this environment" — swallow silently.
    const MISSING_SCHEMA_CODES = new Set(['42P01', 'PGRST205', 'PGRST202']);

    const cleanupByPost = async (table: string) => {
      try {
        // Try with brand_id first (extra safety on shared envs).
        let res = await adminDb.from(table).delete().eq('post_id', id).eq('brand_id', brand.id);
        if (res.error && (res.error.code === '42703' /* undefined column */)) {
          // Fall back: brand_id column doesn't exist on this table → delete by post_id only.
          res = await adminDb.from(table).delete().eq('post_id', id);
        }
        if (res.error && !MISSING_SCHEMA_CODES.has(res.error.code ?? '')) {
          console.warn(`[DELETE /api/posts/${id}] cleanup ${table} failed`, res.error);
        }
      } catch (e) {
        console.warn(`[DELETE /api/posts/${id}] cleanup ${table} threw`, e);
      }
    };

    // content_ideas has FK → posts(id) WITHOUT cascade. We keep the idea
    // (it's part of a weekly_plan the client may still need) but null the
    // post link so Postgres lets us delete the post.
    try {
      const res = await adminDb
        .from('content_ideas')
        .update({ post_id: null, status: 'pending' })
        .eq('post_id', id);
      if (res.error && !MISSING_SCHEMA_CODES.has(res.error.code ?? '')) {
        console.warn(`[DELETE /api/posts/${id}] detach content_ideas failed`, res.error);
      }
    } catch (e) {
      console.warn(`[DELETE /api/posts/${id}] detach content_ideas threw`, e);
    }

    // Tables with FK → posts(id) that DON'T have ON DELETE CASCADE.
    await cleanupByPost('recreation_requests');
    await cleanupByPost('brand_trends');
    await cleanupByPost('feed_queue');
    // post_publications has ON DELETE CASCADE in the migration, but keeping this
    // explicit cleanup is safe (no-op if cascade fired) and defensive against envs
    // where the cascade wasn't applied — prevents ghost "scheduled" rows in the Feed.
    await cleanupByPost('post_publications');
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
    console.error('[DELETE /api/posts/[id]]', err);
    return apiError(err, 'posts/[id]');
  }
}
