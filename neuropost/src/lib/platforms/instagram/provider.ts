// ─────────────────────────────────────────────────────────────────────────────
// NeuroPost — InstagramProvider
// Wraps src/lib/meta.ts for everything Instagram Business Graph API related.
// Long-lived tokens last 60 days and can be refreshed indefinitely.
// ─────────────────────────────────────────────────────────────────────────────

import type { PlatformProvider } from '../provider';
import type {
  Connection,
  NormalizedPost,
  PublishResult,
  FeedOptions,
  FeedItem,
  PlatformInsights,
  AccountInsights,
  OptimalTime,
  DateRange,
  PostFormat,
} from '../types';
import { ProviderError } from '../types';
import {
  publishToInstagram,
  publishReelToInstagram,
  publishStoryToInstagram,
  getIGFeedMedia,
  getIGPostInsights,
  refreshLongLivedToken,
  MetaGraphError,
} from '@/lib/meta';

const SUPPORTED: readonly PostFormat[] = ['foto', 'carousel', 'video', 'reel', 'story'] as const;

const MAX_CAPTION_LEN = 2200;
const MAX_HASHTAGS    = 30;

export class InstagramProvider implements PlatformProvider {
  readonly platform         = 'instagram' as const;
  readonly supportedFormats = SUPPORTED;

  // ── Validation ────────────────────────────────────────────────────────────

  canPublish(post: NormalizedPost) {
    if (!SUPPORTED.includes(post.format)) {
      return { ok: false as const, reason: `Instagram no soporta el formato "${post.format}".` };
    }
    if (post.assets.length === 0) {
      return { ok: false as const, reason: 'Instagram requiere al menos una imagen o vídeo.' };
    }
    if (post.format === 'carousel' && (post.assets.length < 2 || post.assets.length > 10)) {
      return { ok: false as const, reason: 'Un carousel de Instagram necesita entre 2 y 10 elementos.' };
    }
    if ((post.caption?.length ?? 0) > MAX_CAPTION_LEN) {
      return { ok: false as const, reason: `El caption supera los ${MAX_CAPTION_LEN} caracteres que permite Instagram.` };
    }
    if (post.hashtags.length > MAX_HASHTAGS) {
      return { ok: false as const, reason: `Máximo ${MAX_HASHTAGS} hashtags en Instagram.` };
    }
    return { ok: true as const };
  }

  // ── Publish ───────────────────────────────────────────────────────────────

  async publish(post: NormalizedPost, conn: Connection): Promise<PublishResult> {
    const v = this.canPublish(post);
    if (!v.ok) throw new ProviderError({ message: v.reason, code: 'validation', platform: 'instagram' });

    const caption = composeCaption(post.caption, post.hashtags);
    const asset   = post.assets[0]!;

    try {
      let r;
      if (post.format === 'reel' || post.format === 'video') {
        if (asset.type !== 'video') {
          throw new ProviderError({
            message: 'Formato reel/video requiere un asset de tipo video.',
            code: 'invalid_asset', platform: 'instagram',
          });
        }
        r = await publishReelToInstagram({
          igAccountId: conn.platformUserId,
          videoUrl:    asset.url,
          caption,
          accessToken: conn.accessToken,
          shareToFeed: true,
        });
      } else if (post.format === 'story') {
        r = await publishStoryToInstagram({
          igAccountId: conn.platformUserId,
          imageUrl:    asset.url,
          accessToken: conn.accessToken,
        });
      } else {
        // foto / carousel — we only wrap the single-photo path in phase 1.
        // Carousel support lives in publishCarouselToInstagram in lib/meta.ts
        // but isn't uniformly used today; phase 2 will route carousel through
        // the provider too. For now a carousel attempt falls back to the first
        // asset to avoid a hard failure.
        r = await publishToInstagram({
          igAccountId: conn.platformUserId,
          imageUrl:    asset.url,
          caption,
          accessToken: conn.accessToken,
        });
      }
      return {
        platformPostId:   r.postId,
        platformPostUrl:  r.permalink || undefined,
        publishedAt:      new Date(r.publishedAt),
      };
    } catch (err) {
      throw this.normalize(err);
    }
  }

  // ── Tokens ────────────────────────────────────────────────────────────────

  async refreshToken(conn: Connection): Promise<Connection> {
    try {
      const r = await refreshLongLivedToken(conn.accessToken);
      return {
        ...conn,
        accessToken: r.accessToken,
        expiresAt:   new Date(Date.now() + r.expiresIn * 1000),
      };
    } catch (err) {
      throw this.normalize(err);
    }
  }

  // ── Reads ─────────────────────────────────────────────────────────────────

  async fetchFeed(conn: Connection, options: FeedOptions = {}): Promise<FeedItem[]> {
    const limit = Math.min(options.limit ?? 25, 100);
    const media = await getIGFeedMedia(conn.platformUserId, conn.accessToken, limit);
    return media
      .map((m): FeedItem => ({
        platformPostId: m.id,
        publishedAt:    m.timestamp ? new Date(m.timestamp) : new Date(0),
        type:
          m.media_type === 'VIDEO'          ? 'video'    :
          m.media_type === 'CAROUSEL_ALBUM' ? 'carousel' :
          m.media_type === 'REELS'          ? 'reel'     :
          'image',
        caption:       m.caption       ?? null,
        thumbnailUrl:  m.thumbnail_url ?? m.media_url ?? null,
        permalink:     m.permalink     ?? null,
      }))
      // Secondary filter — the Graph API doesn't accept since/until
      // params on the feed endpoint.
      .filter((it) => {
        if (options.since && it.publishedAt < options.since) return false;
        if (options.until && it.publishedAt > options.until) return false;
        return true;
      });
  }

  async fetchPostInsights(platformPostId: string, conn: Connection): Promise<PlatformInsights> {
    const i = await getIGPostInsights(platformPostId, conn.accessToken);
    return {
      platform:     'instagram',
      reach:        i.reach,
      impressions:  i.impressions,
      likes:        i.likes,
      comments:     i.comments,
      saves:        i.saved,
      shares:       i.shares,
    };
  }

  async fetchAccountInsights(_conn: Connection, _range: DateRange): Promise<AccountInsights> {
    // Phase 2: call /{igAccountId}/insights with metric=impressions,reach,profile_views
    // and aggregate over the range, plus query post_analytics for topPosts.
    throw new ProviderError({
      message:  'InstagramProvider.fetchAccountInsights not implemented yet (phase 2).',
      code:     'not_implemented',
      platform: 'instagram',
    });
  }

  async fetchOptimalTimes(_conn: Connection): Promise<OptimalTime[]> {
    // Phase 2: read last-90d post_analytics, group by (dow, hour), return top 10.
    throw new ProviderError({
      message:  'InstagramProvider.fetchOptimalTimes not implemented yet (phase 2).',
      code:     'not_implemented',
      platform: 'instagram',
    });
  }

  // ── Error classifier ──────────────────────────────────────────────────────

  private normalize(err: unknown): ProviderError {
    if (err instanceof ProviderError) return err;
    const msg = err instanceof Error ? err.message : String(err);

    if (err instanceof MetaGraphError) {
      // Common Meta error codes:
      //   190  — access token invalid / expired
      //   4    — rate limit
      //   100  — invalid param / unsupported
      if (err.code === 190) {
        return new ProviderError({
          message: msg, code: 'token_expired', platform: 'instagram',
          retryable: false, platformCode: String(err.code),
        });
      }
      if (err.code === 4 || err.code === 32 || err.code === 613) {
        return new ProviderError({
          message: msg, code: 'rate_limited', platform: 'instagram',
          retryable: true, platformCode: String(err.code),
        });
      }
      return new ProviderError({
        message: msg, code: 'platform_error', platform: 'instagram',
        retryable: err.retryable, platformCode: String(err.code),
      });
    }

    if (/fetch failed|ENOTFOUND|ETIMEDOUT|ECONNRESET/i.test(msg)) {
      return new ProviderError({ message: msg, code: 'network', platform: 'instagram', retryable: true });
    }
    return new ProviderError({ message: msg, code: 'platform_error', platform: 'instagram' });
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function composeCaption(caption: string, hashtags: string[]): string {
  const tagLine = hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ');
  return [caption, tagLine].filter(Boolean).join('\n\n').slice(0, MAX_CAPTION_LEN);
}
