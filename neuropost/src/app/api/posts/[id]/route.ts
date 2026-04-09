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

    const { data, error } = await supabase
      .from('posts').update(updatePayload).eq('id', id).eq('brand_id', brand.id).select().single();
    if (error) throw error;
    await syncPostIntoFeedQueue(createAdminClient(), data as Post);
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

    const { data: brand } = await supabase.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { error } = await supabase.from('posts').delete().eq('id', id).eq('brand_id', brand.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
