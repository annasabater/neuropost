// =============================================================================
// POST /api/tiktok/publish — publish a video post to TikTok
// =============================================================================
// Takes a post_id, checks it has a video URL and the brand has TikTok connected,
// then publishes via TikTok's Pull Upload API.

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { rateLimitWrite } from '@/lib/ratelimit';
import { requireServerUser, createAdminClient } from '@/lib/supabase';
import { publishVideoToTikTok } from '@/lib/tiktok';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export const maxDuration = 120; // TikTok polling can take up to 100s

export async function POST(request: Request) {
  try {
    const rl = await rateLimitWrite(request);
    if (rl) return rl;

    const user = await requireServerUser();
    const db = createAdminClient() as DB;
    const body = await request.json() as { post_id: string };

    if (!body.post_id) {
      return NextResponse.json({ error: 'post_id requerido' }, { status: 400 });
    }

    // Load brand + TikTok credentials
    const { data: brand } = await db
      .from('brands')
      .select('id, tiktok_access_token, tiktok_token_expires_at')
      .eq('user_id', user.id)
      .single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    if (!brand.tiktok_access_token) {
      return NextResponse.json({ error: 'TikTok no está conectado. Conéctalo en Ajustes → Conexiones.' }, { status: 400 });
    }

    // Check token expiry
    if (brand.tiktok_token_expires_at && new Date(brand.tiktok_token_expires_at) < new Date()) {
      // Try refresh
      try {
        const { refreshTikTokToken } = await import('@/lib/tiktok');
        const refreshed = await refreshTikTokToken(brand.tiktok_refresh_token);
        await db.from('brands').update({
          tiktok_access_token:     refreshed.accessToken,
          tiktok_refresh_token:    refreshed.refreshToken,
          tiktok_token_expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
        }).eq('id', brand.id);
        brand.tiktok_access_token = refreshed.accessToken;
      } catch {
        return NextResponse.json({ error: 'Token de TikTok expirado. Reconecta tu cuenta.' }, { status: 401 });
      }
    }

    // Load post
    const { data: post } = await db
      .from('posts')
      .select('id, caption, hashtags, image_url, edited_image_url, format, status')
      .eq('id', body.post_id)
      .eq('brand_id', brand.id)
      .single();
    if (!post) return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 });

    // TikTok only supports video posts
    const videoUrl = post.edited_image_url ?? post.image_url;
    if (!videoUrl) {
      return NextResponse.json({ error: 'El post no tiene vídeo. TikTok solo acepta vídeos.' }, { status: 400 });
    }

    // Build caption with hashtags
    const hashtags = (post.hashtags ?? []).map((h: string) => h.startsWith('#') ? h : `#${h}`).join(' ');
    const fullCaption = [post.caption, hashtags].filter(Boolean).join('\n\n');

    // Publish to TikTok
    const result = await publishVideoToTikTok({
      accessToken: brand.tiktok_access_token,
      videoUrl,
      caption: fullCaption,
    });

    // Save TikTok post ID
    await db.from('posts').update({
      tiktok_video_id:   result.postId,
      tiktok_publish_id: result.postId,
      published_at:      post.status !== 'published' ? result.publishedAt : undefined,
      status:            'published',
    }).eq('id', post.id);

    // Log activity
    await db.from('activity_log').insert({
      brand_id:    brand.id,
      user_id:     user.id,
      action:      'tiktok_published',
      entity_type: 'post',
      entity_id:   post.id,
      details:     { tiktok_video_id: result.postId },
    });

    return NextResponse.json({ ok: true, tiktok_video_id: result.postId });
  } catch (err) {
    return apiError(err, 'POST /api/tiktok/publish');
  }
}
