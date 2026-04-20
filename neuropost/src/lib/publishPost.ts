// Shared publish logic — called directly by both /api/publish and auto-publish in /api/posts
import { createAdminClient } from '@/lib/supabase';
import {
  publishToInstagram,
  publishStoryToInstagram,
  publishReelToInstagram,
  publishToFacebook,
  publishVideoToFacebook,
} from '@/lib/meta';
import { publishVideoToTikTok } from '@/lib/tiktok';
import { incrementPostCounter, incrementStoryCounter } from '@/lib/plan-limits';
import { markPostAsPublishedInFeedQueue } from '@/lib/feedQueue';
import type { Post, Brand } from '@/types';

export interface PublishResult {
  ok:          boolean;
  igPostId?:   string;
  fbPostId?:   string;
  ttPostId?:   string;
  publishedAt: string;
  errors:      string[];
}

export async function publishPostById(postId: string, userId: string): Promise<PublishResult> {
  const supabase = createAdminClient();

  const { data: brand } = await supabase
    .from('brands').select('*').eq('user_id', userId).single();

  if (!brand) throw new Error('Brand not found');
  const typedBrand = brand as Brand;

  const { data: post } = await supabase
    .from('posts').select('*').eq('id', postId).eq('brand_id', typedBrand.id).single();

  if (!post) throw new Error('Post not found');
  const typedPost = post as Post;

  if (typedPost.status !== 'approved') throw new Error('El post debe estar aprobado antes de publicar');

  const mediaUrl = typedPost.edited_image_url ?? typedPost.image_url;
  if (!mediaUrl) throw new Error('El post no tiene contenido multimedia');

  const caption = [typedPost.caption ?? '', ...(typedPost.hashtags ?? [])].filter(Boolean).join('\n\n');
  const isReel   = typedPost.format === 'reel';
  const now      = new Date().toISOString();

  const updates: Record<string, unknown> = {
    status:       'published',
    published_at: now,
  };
  const errors: string[] = [];

  // ── Instagram ────────────────────────────────────────────────────────────────
  if (typedPost.platform.includes('instagram')) {
    if (typedBrand.ig_account_id && typedBrand.ig_access_token) {
      try {
        if (isReel) {
          const result = await publishReelToInstagram({
            igAccountId: typedBrand.ig_account_id,
            videoUrl:    mediaUrl,
            caption,
            accessToken: typedBrand.ig_access_token,
          });
          updates.ig_post_id = result.postId;
          await incrementPostCounter(typedBrand.id);
        } else if (typedPost.is_story) {
          const result = await publishStoryToInstagram({
            igAccountId: typedBrand.ig_account_id,
            imageUrl:    mediaUrl,
            accessToken: typedBrand.ig_access_token,
          });
          updates.ig_post_id = result.postId;
          await incrementStoryCounter(typedBrand.id);
        } else {
          const result = await publishToInstagram({
            igAccountId: typedBrand.ig_account_id,
            imageUrl:    mediaUrl,
            caption,
            accessToken: typedBrand.ig_access_token,
            altText:     typedPost.caption?.slice(0, 100) ?? undefined,
          });
          updates.ig_post_id = result.postId;
          await incrementPostCounter(typedBrand.id);
        }
      } catch (err) {
        errors.push(`Instagram: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      errors.push('Instagram no está conectado. Conecta tu cuenta en Ajustes.');
    }
  }

  // ── Facebook ─────────────────────────────────────────────────────────────────
  if (typedPost.platform.includes('facebook')) {
    if (typedBrand.fb_page_id && typedBrand.fb_access_token) {
      try {
        if (isReel) {
          const result = await publishVideoToFacebook({
            pageId:      typedBrand.fb_page_id,
            videoUrl:    mediaUrl,
            caption,
            accessToken: typedBrand.fb_access_token,
          });
          updates.fb_post_id = result.postId;
        } else {
          const result = await publishToFacebook({
            pageId:      typedBrand.fb_page_id,
            imageUrl:    mediaUrl,
            caption,
            accessToken: typedBrand.fb_access_token,
          });
          updates.fb_post_id = result.postId;
        }
        await incrementPostCounter(typedBrand.id);
      } catch (err) {
        errors.push(`Facebook: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      errors.push('Facebook no está conectado. Conecta tu página en Ajustes.');
    }
  }

  // ── TikTok (vídeos únicamente) ────────────────────────────────────────────
  if (typedPost.platform.includes('tiktok')) {
    if (!isReel) {
      errors.push('TikTok: solo se pueden publicar vídeos (formato Reel). Cambia el formato del post.');
    } else if (typedBrand.tt_access_token && typedBrand.tt_open_id) {
      try {
        const result = await publishVideoToTikTok({
          accessToken: typedBrand.tt_access_token,
          videoUrl:    mediaUrl,
          caption,
        });
        updates.tt_post_id = result.postId;
        await incrementPostCounter(typedBrand.id);
      } catch (err) {
        errors.push(`TikTok: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      errors.push('TikTok no está conectado. Conecta tu cuenta en Ajustes.');
    }
  }

  // ── Result handling ───────────────────────────────────────────────────────────
  const anySuccess = updates.ig_post_id || updates.fb_post_id || updates.tt_post_id;
  if (!anySuccess && errors.length > 0) {
    await supabase.from('posts').update({ status: 'failed' }).eq('id', postId);
    await supabase.from('notifications').insert({
      brand_id: typedBrand.id,
      type:     'failed',
      message:  `Error al publicar: ${errors.join('; ')}`,
      read:     false,
      metadata: { postId },
    });
    throw new Error(errors.join('; '));
  }

  await supabase.from('posts').update(updates).eq('id', postId);
  await markPostAsPublishedInFeedQueue(supabase, typedBrand.id, postId, mediaUrl);

  const platforms = typedPost.platform.join(', ');
  await supabase.from('activity_log').insert({
    brand_id:    typedBrand.id,
    user_id:     userId,
    action:      'post_published',
    entity_type: 'post',
    entity_id:   postId,
    details:     {
      ig_post_id: updates.ig_post_id,
      fb_post_id: updates.fb_post_id,
      tt_post_id: updates.tt_post_id,
      platforms,
      errors,
    },
  });

  await supabase.from('notifications').insert({
    brand_id: typedBrand.id,
    type:     'published',
    message:  errors.length
      ? `Post publicado en ${platforms} con advertencias: ${errors.join('; ')}`
      : `Tu post fue publicado correctamente en ${platforms}.`,
    read:     false,
    metadata: { postId },
  });

  return {
    ok:          true,
    igPostId:    updates.ig_post_id as string | undefined,
    fbPostId:    updates.fb_post_id as string | undefined,
    ttPostId:    updates.tt_post_id as string | undefined,
    publishedAt: now,
    errors,
  };
}
