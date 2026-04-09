import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient, createAdminClient } from '@/lib/supabase';
import { getIGFeedMedia } from '@/lib/meta';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

interface QueuePostRow {
  id: string;
  image_url: string | null;
  edited_image_url: string | null;
  caption: string | null;
  status: string;
  scheduled_at: string | null;
  created_at: string;
}

interface FeedQueueRow {
  id: string;
  post_id: string | null;
  image_url: string | null;
  position: number;
  scheduled_at: string | null;
}

export async function GET() {
  try {
    const user = await requireServerUser();
    const supabase = await createServerClient() as DB;
    const db = createAdminClient();

    const { data: brand } = await supabase
      .from('brands')
      .select('id,ig_account_id,ig_access_token,ig_username')
      .eq('user_id', user.id)
      .single();

    if (!brand) {
      return NextResponse.json({ connected: false, published: [], queued: [] });
    }

    const [{ data: posts }, { data: queueRows }] = await Promise.all([
      db
        .from('posts')
        .select('id,image_url,edited_image_url,caption,status,scheduled_at,created_at')
        .eq('brand_id', brand.id)
        .contains('platform', ['instagram'])
        .in('status', ['draft', 'generated', 'pending', 'approved', 'scheduled'])
        .or('image_url.not.is.null,edited_image_url.not.is.null')
        .order('scheduled_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }),
      db
        .from('feed_queue')
        .select('id,post_id,image_url,position,scheduled_at')
        .eq('brand_id', brand.id)
        .eq('is_published', false)
        .order('position', { ascending: true }),
    ]);

    const rowsByPostId = new Map<string, FeedQueueRow>();
    for (const row of (queueRows ?? []) as FeedQueueRow[]) {
      if (row.post_id) rowsByPostId.set(row.post_id, row);
    }

    const queuedBase = ((posts ?? []) as QueuePostRow[]).map((post, index) => {
      const queueRow = rowsByPostId.get(post.id);
      return {
        id:          queueRow?.id ?? `post:${post.id}`,
        queueId:     queueRow?.id ?? null,
        postId:      post.id,
        imageUrl:    post.edited_image_url ?? post.image_url,
        caption:     post.caption,
        status:      post.status,
        scheduledAt: queueRow?.scheduled_at ?? post.scheduled_at,
        position:    queueRow?.position ?? index,
      };
    });

    const queued = queuedBase.sort((a, b) => a.position - b.position);

    let published: Array<{
      id: string;
      imageUrl: string | null;
      caption: string | null;
      permalink: string | null;
      timestamp: string | null;
    }> = [];

    if (brand.ig_account_id && brand.ig_access_token) {
      try {
        const media = await getIGFeedMedia(brand.ig_account_id, brand.ig_access_token, 12);
        published = media
          .filter((item) => item.media_type !== 'STORY')
          .map((item) => ({
            id:        item.id,
            imageUrl:  item.media_type === 'VIDEO' ? (item.thumbnail_url ?? item.media_url ?? null) : (item.media_url ?? item.thumbnail_url ?? null),
            caption:   item.caption ?? null,
            permalink: item.permalink ?? null,
            timestamp: item.timestamp ?? null,
          }))
          .filter((item) => Boolean(item.imageUrl));
      } catch (err) {
        console.error('Meta feed preview error:', err);
      }
    }

    return NextResponse.json({
      connected: Boolean(brand.ig_account_id && brand.ig_access_token),
      username:  brand.ig_username ?? null,
      published,
      queued,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
