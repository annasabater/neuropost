import { NextResponse } from 'next/server';
import { getIGComments } from '@/lib/meta';
import { createAdminClient } from '@/lib/supabase';

// Called by Vercel Cron: GET /api/meta/sync-comments
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET ?? ''}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createAdminClient();

  // Get all brands with IG connected
  const { data: brands } = await supabase
    .from('brands')
    .select('id,ig_account_id,ig_access_token')
    .not('ig_account_id', 'is', null)
    .not('ig_access_token', 'is', null);

  if (!brands?.length) return NextResponse.json({ synced: 0 });

  let total = 0;

  for (const brand of brands) {
    // Get published posts with ig_post_id
    const { data: posts } = await supabase
      .from('posts')
      .select('id,ig_post_id')
      .eq('brand_id', brand.id)
      .eq('status', 'published')
      .not('ig_post_id', 'is', null)
      .order('published_at', { ascending: false })
      .limit(10);

    if (!posts?.length) continue;

    for (const post of posts) {
      let comments: Awaited<ReturnType<typeof getIGComments>>;
      try {
        comments = await getIGComments(post.ig_post_id!, brand.ig_access_token!);
      } catch {
        continue;
      }

      for (const c of comments) {
        const { data: existing } = await supabase
          .from('comments')
          .select('id')
          .eq('external_id', c.id)
          .maybeSingle();

        if (existing) continue;

        await supabase.from('comments').insert({
          brand_id:    brand.id,
          post_id:     post.id,
          platform:    'instagram',
          external_id: c.id,
          author:      c.username,
          content:     c.text,
          status:      'pending',
        });

        await supabase.from('notifications').insert({
          brand_id: brand.id,
          type:     'comment',
          message:  `Nuevo comentario de @${c.username}: "${c.text.slice(0, 80)}"`,
          read:     false,
          metadata: { post_id: post.id, external_id: c.id },
        });

        total++;
      }
    }
  }

  return NextResponse.json({ synced: total });
}
