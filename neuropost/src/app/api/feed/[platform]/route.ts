// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/feed/[platform]
//    → {
//        platform:  'instagram' | 'facebook' | 'tiktok',
//        connected: boolean,
//        username:  string | null,
//        published: [{ id, imageUrl, caption, permalink, timestamp, type }],
//        queued:    [{ id, postId, imageUrl, caption, status, scheduledAt }]
//      }
//
//  Unified feed endpoint used by /feed (dashboard) and any future
//  place that needs "show this brand's content on platform X". Wraps
//  the provider.fetchFeed + post_publications.scheduled in one payload.
//
//  Owner-only.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createAdminClient } from '@/lib/supabase';
import {
  getProvider,
  getConnection,
  parsePlatform,
  type Platform,
  type FeedItem,
} from '@/lib/platforms';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

interface QueuedPost {
  id:           string;
  postId:       string;
  imageUrl:     string | null;
  caption:      string | null;
  status:       string;
  scheduledAt:  string | null;
}

interface PublicationJoin {
  id:            string;
  post_id:       string;
  status:        string;
  scheduled_at:  string | null;
  post: {
    caption:          string | null;
    image_url:        string | null;
    edited_image_url: string | null;
  } | null;
}

async function loadQueued(db: DB, brandId: string, platform: Platform): Promise<QueuedPost[]> {
  const nowIso = new Date().toISOString();
  const { data } = await db
    .from('post_publications')
    .select(`
      id, post_id, status, scheduled_at,
      post:posts!inner(caption, image_url, edited_image_url, brand_id)
    `)
    .eq('platform', platform)
    .in('status', ['scheduled', 'pending', 'publishing', 'failed'])
    .eq('posts.brand_id', brandId)
    .or(`scheduled_at.is.null,scheduled_at.gte.${nowIso}`)
    .order('scheduled_at', { ascending: true, nullsFirst: true })
    .limit(40);

  return ((data ?? []) as PublicationJoin[]).map((r): QueuedPost => ({
    id:          r.id,
    postId:      r.post_id,
    imageUrl:    r.post?.edited_image_url ?? r.post?.image_url ?? null,
    caption:     r.post?.caption ?? null,
    status:      r.status,
    scheduledAt: r.scheduled_at,
  }));
}

function feedItemsToPublished(items: FeedItem[]) {
  return items.map(it => ({
    id:        it.platformPostId,
    imageUrl:  it.thumbnailUrl,
    caption:   it.caption,
    permalink: it.permalink,
    timestamp: it.publishedAt.toISOString(),
    type:      it.type,
  }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  try {
    const { platform: rawPlatform } = await params;
    const platform = parsePlatform(rawPlatform);
    if (!platform) {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
    }

    const user = await requireServerUser();
    const db   = createAdminClient() as DB;

    const { data: brand } = await db
      .from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    const connection = await getConnection(brand.id, platform);

    if (!connection) {
      // Still return the queued pending publications — e.g. we might have
      // scheduled a TT post before the user connects.
      const queued = await loadQueued(db, brand.id, platform);
      return NextResponse.json({
        platform,
        connected: false,
        username:  null,
        published: [],
        queued,
      });
    }

    // Fetch feed from the platform — provider may throw when the API
    // isn't wired yet (TikTok research API). Don't block the rest of the
    // payload on that.
    let published: ReturnType<typeof feedItemsToPublished> = [];
    try {
      const feed = await getProvider(platform).fetchFeed(connection, { limit: 18 });
      published = feedItemsToPublished(feed);
    } catch {
      // Intentional swallow — UI will show "published feed not available
      // yet" for this platform while we still show queued/scheduled rows.
    }

    const queued = await loadQueued(db, brand.id, platform);

    return NextResponse.json({
      platform,
      connected: connection.status === 'active',
      username:  connection.platformUsername,
      published,
      queued,
    });
  } catch (err) {
    return apiError(err, 'GET /api/feed/[platform]');
  }
}
