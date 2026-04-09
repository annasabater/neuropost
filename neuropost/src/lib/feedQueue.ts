import type { Platform, PostStatus } from '@/types';
import { getIGFeedMedia } from '@/lib/meta';

type QueueablePost = {
  id: string;
  brand_id: string;
  image_url: string | null;
  edited_image_url: string | null;
  platform: Platform[];
  status: PostStatus;
  scheduled_at: string | null;
  created_at?: string;
  is_story?: boolean;
};

const QUEUEABLE_STATUSES: PostStatus[] = ['draft', 'generated', 'pending', 'approved', 'scheduled'];

function hasInstagramPlatform(post: QueueablePost): boolean {
  return Array.isArray(post.platform) && post.platform.includes('instagram');
}

function getPostMediaUrl(post: QueueablePost): string | null {
  return post.edited_image_url ?? post.image_url ?? null;
}

export function shouldQueueInstagramPost(post: QueueablePost): boolean {
  return hasInstagramPlatform(post)
    && QUEUEABLE_STATUSES.includes(post.status)
    && !post.is_story
    && Boolean(getPostMediaUrl(post));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function syncPostIntoFeedQueue(db: any, post: QueueablePost): Promise<void> {
  const { data: existing } = await db
    .from('feed_queue')
    .select('id,post_id,position,is_published')
    .eq('brand_id', post.brand_id)
    .eq('post_id', post.id)
    .maybeSingle();

  if (!shouldQueueInstagramPost(post)) {
    if (existing && !existing.is_published) {
      await db.from('feed_queue').delete().eq('id', existing.id).eq('brand_id', post.brand_id);
    }
    return;
  }

  const imageUrl = getPostMediaUrl(post);

  if (existing) {
    await db
      .from('feed_queue')
      .update({
        image_url: imageUrl,
        scheduled_at: post.scheduled_at,
      })
      .eq('id', existing.id)
      .eq('brand_id', post.brand_id);
    return;
  }

  const { data: rows } = await db
    .from('feed_queue')
    .select('position')
    .eq('brand_id', post.brand_id)
    .eq('is_published', false)
    .order('position', { ascending: false })
    .limit(1);

  const nextPosition = typeof rows?.[0]?.position === 'number' ? rows[0].position + 1 : 0;

  await db.from('feed_queue').insert({
    brand_id: post.brand_id,
    post_id: post.id,
    image_url: imageUrl,
    position: nextPosition,
    is_published: false,
    scheduled_at: post.scheduled_at,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function syncBrandPostsIntoFeedQueue(db: any, brandId: string): Promise<void> {
  const { data: posts } = await db
    .from('posts')
    .select('id,brand_id,image_url,edited_image_url,platform,status,scheduled_at,is_story,created_at')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: true });

  for (const post of (posts ?? []) as QueueablePost[]) {
    await syncPostIntoFeedQueue(db, post);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function markPostAsPublishedInFeedQueue(db: any, brandId: string, postId: string, imageUrl?: string | null): Promise<void> {
  const { data: existing } = await db
    .from('feed_queue')
    .select('id')
    .eq('brand_id', brandId)
    .eq('post_id', postId)
    .maybeSingle();

  if (existing) {
    await db
      .from('feed_queue')
      .update({
        is_published: true,
        image_url: imageUrl ?? undefined,
      })
      .eq('id', existing.id)
      .eq('brand_id', brandId);
    return;
  }

  if (!imageUrl) return;

  await db.from('feed_queue').insert({
    brand_id: brandId,
    post_id: postId,
    image_url: imageUrl,
    position: 0,
    is_published: true,
    scheduled_at: null,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function syncInstagramPublishedSnapshot(db: any, brandId: string, igAccountId: string, accessToken: string): Promise<void> {
  const media = await getIGFeedMedia(igAccountId, accessToken, 9);
  const published = media
    .filter((item) => item.media_type !== 'STORY')
    .map((item, index) => ({
      brand_id: brandId,
      post_id: null,
      image_url: item.media_type === 'VIDEO' ? (item.thumbnail_url ?? item.media_url ?? null) : (item.media_url ?? item.thumbnail_url ?? null),
      position: index,
      is_published: true,
      scheduled_at: null,
    }))
    .filter((item) => Boolean(item.image_url));

  await db.from('feed_queue').delete().eq('brand_id', brandId).eq('is_published', true).is('post_id', null);

  if (published.length) {
    await db.from('feed_queue').insert(published);
  }
}
