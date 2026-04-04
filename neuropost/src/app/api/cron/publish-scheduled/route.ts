import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { publishToInstagram, publishToFacebook } from '@/lib/meta';
import type { Post, Brand } from '@/types';

// Vercel Cron: runs every hour — publishes posts whose scheduled_at has passed
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET ?? ''}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createAdminClient();
  const now      = new Date().toISOString();

  // Fetch all posts that are scheduled and due
  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now);

  if (!posts?.length) return NextResponse.json({ published: 0 });

  let published = 0;

  for (const rawPost of posts) {
    const post = rawPost as Post;

    // Get brand
    const { data: rawBrand } = await supabase
      .from('brands')
      .select('*')
      .eq('id', post.brand_id)
      .single();

    if (!rawBrand) continue;
    const brand = rawBrand as Brand;

    const imageUrl = post.edited_image_url ?? post.image_url;
    if (!imageUrl) continue;

    const caption = [post.caption ?? '', ...(post.hashtags ?? [])].filter(Boolean).join('\n\n');
    const updates: Partial<Post & { status: string }> = { status: 'published', published_at: now };

    if (post.platform.includes('instagram') && brand.ig_account_id && brand.ig_access_token) {
      try {
        const result = await publishToInstagram({
          igAccountId:  brand.ig_account_id,
          imageUrl,
          caption,
          accessToken:  brand.ig_access_token,
        });
        updates.ig_post_id = result.postId;
      } catch (err) {
        console.error(`IG publish failed for post ${post.id}:`, err);
        updates.status = 'failed';
      }
    }

    if (post.platform.includes('facebook') && brand.fb_page_id && brand.fb_access_token) {
      try {
        const result = await publishToFacebook({
          pageId:      brand.fb_page_id,
          imageUrl,
          caption,
          accessToken: brand.fb_access_token,
        });
        updates.fb_post_id = result.postId;
      } catch (err) {
        console.error(`FB publish failed for post ${post.id}:`, err);
      }
    }

    await supabase.from('posts').update(updates).eq('id', post.id);

    await supabase.from('notifications').insert({
      brand_id: brand.id,
      type:     updates.status === 'failed' ? 'failed' : 'published',
      message:  updates.status === 'failed'
        ? `Error al publicar el post programado.`
        : `Post programado publicado correctamente.`,
      read:     false,
      metadata: { postId: post.id },
    });

    if (updates.status !== 'failed') published++;
  }

  return NextResponse.json({ published });
}
