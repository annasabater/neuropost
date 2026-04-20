import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { getIGPostInsights } from '@/lib/meta';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

// GET /api/meta/insights?postId=xxx  — fetch and store insights for one post
export async function GET(request: Request) {
  try {
    const user     = await requireServerUser();
    const supabase = await createServerClient() as DB;
    const postId   = new URL(request.url).searchParams.get('postId');

    if (!postId) return NextResponse.json({ error: 'postId required' }, { status: 400 });

    const { data: brand } = await supabase
      .from('brands')
      .select('id,ig_access_token')
      .eq('user_id', user.id)
      .single();

    if (!brand?.ig_access_token) return NextResponse.json({ error: 'Instagram not connected' }, { status: 400 });

    const { data: post } = await supabase
      .from('posts')
      .select('ig_post_id')
      .eq('id', postId)
      .eq('brand_id', brand.id)
      .single();

    if (!post?.ig_post_id) return NextResponse.json({ error: 'Post not published to Instagram' }, { status: 400 });

    const metrics = await getIGPostInsights(post.ig_post_id, brand.ig_access_token);

    await supabase
      .from('posts')
      .update({ metrics })
      .eq('id', postId);

    return NextResponse.json({ metrics });
  } catch (err) {
    return apiError(err, 'meta/insights');
  }
}
