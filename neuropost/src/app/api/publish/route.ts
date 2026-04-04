import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { publishToInstagram, publishToFacebook, publishStoryToInstagram, publishReelToInstagram } from '@/lib/meta';
import { incrementPostCounter, incrementStoryCounter } from '@/lib/plan-limits';
import type { Post, Brand } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function POST(request: Request) {
  try {
    const user     = await requireServerUser();
    const { postId } = await request.json() as { postId: string };
    const supabase   = await createServerClient() as DB;

    // Get brand with social tokens
    const { data: brand } = await supabase
      .from('brands')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const typedBrand = brand as Brand;

    // Get post
    const { data: post } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .eq('brand_id', typedBrand.id)
      .single();

    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    const typedPost = post as Post;

    if (typedPost.status !== 'approved') {
      return NextResponse.json({ error: 'El post debe estar aprobado antes de publicar' }, { status: 400 });
    }

    const isReel = typedPost.format === 'reel';

    // Resolve media URL (must be publicly accessible for Meta)
    const mediaUrl = typedPost.edited_image_url ?? typedPost.image_url;
    // For Reels, video_url is stored in image_url field (reusing the column)
    if (!mediaUrl) {
      return NextResponse.json({ error: 'El post no tiene contenido multimedia' }, { status: 400 });
    }

    const caption = [typedPost.caption ?? '', ...(typedPost.hashtags ?? [])].filter(Boolean).join('\n\n');

    const now   = new Date().toISOString();
    const updates: Partial<Post> = { status: 'published', published_at: now };
    const errors: string[] = [];

    // ── Publish to Instagram ──────────────────────────────��────────────────────
    if (typedPost.platform.includes('instagram') && typedBrand.ig_account_id && typedBrand.ig_access_token) {
      try {
        if (isReel) {
          const result = await publishReelToInstagram({
            igAccountId:  typedBrand.ig_account_id,
            videoUrl:     mediaUrl,
            caption,
            accessToken:  typedBrand.ig_access_token,
          });
          updates.ig_post_id = result.postId;
          await incrementPostCounter(typedBrand.id);
        } else if (typedPost.is_story) {
          const result = await publishStoryToInstagram({
            igAccountId:  typedBrand.ig_account_id,
            imageUrl:     mediaUrl,
            accessToken:  typedBrand.ig_access_token,
          });
          updates.ig_post_id = result.postId;
          await incrementStoryCounter(typedBrand.id);
        } else {
          const result = await publishToInstagram({
            igAccountId:  typedBrand.ig_account_id,
            imageUrl:     mediaUrl,
            caption,
            accessToken:  typedBrand.ig_access_token,
          });
          updates.ig_post_id = result.postId;
          await incrementPostCounter(typedBrand.id);
        }
      } catch (err) {
        errors.push(`Instagram: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else if (typedPost.platform.includes('instagram')) {
      errors.push('Instagram no está conectado. Conecta tu cuenta en Ajustes.');
    }

    // ── Publish to Facebook ────────────────────────────────────────────────────
    if (typedPost.platform.includes('facebook') && typedBrand.fb_page_id && typedBrand.fb_access_token) {
      try {
        const result = await publishToFacebook({
          pageId:      typedBrand.fb_page_id,
          imageUrl:    mediaUrl,
          caption,
          accessToken: typedBrand.fb_access_token,
        });
        updates.fb_post_id = result.postId;
      } catch (err) {
        errors.push(`Facebook: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else if (typedPost.platform.includes('facebook')) {
      errors.push('Facebook no está conectado. Conecta tu página en Ajustes.');
    }

    // If ALL platforms failed, mark as failed
    const anySuccess = updates.ig_post_id || updates.fb_post_id;
    if (!anySuccess && errors.length > 0) {
      await supabase.from('posts').update({ status: 'failed' }).eq('id', postId);
      await supabase.from('notifications').insert({
        brand_id: typedBrand.id,
        type:     'failed',
        message:  `Error al publicar: ${errors.join('; ')}`,
        read:     false,
        metadata: { postId },
      });
      return NextResponse.json({ error: errors.join('; ') }, { status: 502 });
    }

    // Update post status
    const { error: updateErr } = await supabase
      .from('posts')
      .update(updates)
      .eq('id', postId);

    if (updateErr) throw updateErr;

    // Activity log
    await supabase.from('activity_log').insert({
      brand_id:    typedBrand.id,
      user_id:     user.id,
      action:      'post_published',
      entity_type: 'post',
      entity_id:   postId,
      details:     { ig_post_id: updates.ig_post_id, fb_post_id: updates.fb_post_id, errors },
    });

    // Notification
    await supabase.from('notifications').insert({
      brand_id: typedBrand.id,
      type:     'published',
      message:  errors.length
        ? `Post publicado con advertencias: ${errors.join('; ')}`
        : 'Tu post fue publicado correctamente.',
      read:     false,
      metadata: { postId },
    });

    // Email notification (if enabled)
    if (typedBrand.notify_email_publish) {
      try {
        const { sendPostPublishedEmail } = await import('@/lib/email');
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        const { data: authUser } = await supabase.auth.admin.getUserById(user.id);
        const email = authUser?.user?.email;
        if (email) {
          await sendPostPublishedEmail(
            email,
            postId,
            typedPost.platform.join(' y '),
          );
        }
        void profile; // suppress unused warning
      } catch { /* email failure never blocks publish */ }
    }

    return NextResponse.json({ ok: true, publishedAt: now, igPostId: updates.ig_post_id, fbPostId: updates.fb_post_id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
