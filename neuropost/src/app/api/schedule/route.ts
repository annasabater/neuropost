import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import type { Post } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function POST(request: Request) {
  try {
    const user     = await requireServerUser();
    const { postId, scheduledAt } = await request.json() as { postId: string; scheduledAt: string };
    const supabase   = await createServerClient() as DB;

    // Verify post belongs to user's brand
    const { data: brand } = await supabase
      .from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    // Fetch post and validate approved status
    const { data: postData } = await supabase
      .from('posts').select('status').eq('id', postId).eq('brand_id', brand.id).single();
    if (!postData) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    const post = postData as Pick<Post, 'status'>;
    if (post.status !== 'approved') {
      return NextResponse.json({ error: 'El post debe estar aprobado antes de programarlo' }, { status: 400 });
    }

    const scheduled = new Date(scheduledAt);
    if (isNaN(scheduled.getTime()) || scheduled <= new Date()) {
      return NextResponse.json({ error: 'scheduledAt must be a future date' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('posts')
      .update({ status: 'scheduled', scheduled_at: scheduledAt })
      .eq('id', postId)
      .eq('brand_id', brand.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, post: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
