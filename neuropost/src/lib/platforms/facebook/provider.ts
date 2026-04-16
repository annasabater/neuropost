// ─────────────────────────────────────────────────────────────────────────────
// NeuroPost — FacebookProvider
// Wraps src/lib/meta.ts for everything Facebook Pages Graph API related.
// Page access tokens don't expire (if the issuing user token stays valid).
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
  publishToFacebook,
  publishVideoToFacebook,
  publishTextToFacebook,
  refreshLongLivedToken,
  MetaGraphError,
} from '@/lib/meta';

// Facebook Pages accept more formats than IG — we just mirror what the app
// currently uses. Story support would need the Page's Story API which isn't
// wired up, so we drop it from the supported list.
const SUPPORTED: readonly PostFormat[] = ['foto', 'carousel', 'video', 'reel'] as const;

// Facebook's hard limit is 63k characters but anything over ~2k gets truncated
// in the feed UI; keep parity with Instagram to avoid surprise truncation.
const MAX_CAPTION_LEN = 5000;

export class FacebookProvider implements PlatformProvider {
  readonly platform         = 'facebook' as const;
  readonly supportedFormats = SUPPORTED;

  canPublish(post: NormalizedPost) {
    if (!SUPPORTED.includes(post.format)) {
      return { ok: false as const, reason: `Facebook no soporta el formato "${post.format}" en este pipeline.` };
    }
    if (post.assets.length === 0 && !post.caption?.trim()) {
      return { ok: false as const, reason: 'Facebook necesita texto, imagen o vídeo.' };
    }
    if ((post.caption?.length ?? 0) > MAX_CAPTION_LEN) {
      return { ok: false as const, reason: `El texto supera los ${MAX_CAPTION_LEN} caracteres.` };
    }
    return { ok: true as const };
  }

  async publish(post: NormalizedPost, conn: Connection): Promise<PublishResult> {
    const v = this.canPublish(post);
    if (!v.ok) throw new ProviderError({ message: v.reason, code: 'validation', platform: 'facebook' });

    const caption = composeCaption(post.caption, post.hashtags);
    const asset   = post.assets[0];

    try {
      let r;
      if (post.format === 'reel' || post.format === 'video') {
        if (!asset || asset.type !== 'video') {
          throw new ProviderError({
            message: 'Formato reel/video requiere un asset de tipo video.',
            code: 'invalid_asset', platform: 'facebook',
          });
        }
        r = await publishVideoToFacebook({
          pageId:      conn.platformUserId,
          videoUrl:    asset.url,
          caption,
          accessToken: conn.accessToken,
        });
      } else if (asset) {
        // foto / carousel — carousel is flattened to the first image in phase 1.
        r = await publishToFacebook({
          pageId:      conn.platformUserId,
          imageUrl:    asset.url,
          caption,
          accessToken: conn.accessToken,
        });
      } else {
        // Text-only post
        r = await publishTextToFacebook({
          pageId:      conn.platformUserId,
          message:     caption,
          accessToken: conn.accessToken,
        });
      }

      return {
        platformPostId:  r.postId,
        platformPostUrl: r.permalink || undefined,
        publishedAt:     new Date(r.publishedAt),
      };
    } catch (err) {
      throw this.normalize(err);
    }
  }

  async refreshToken(conn: Connection): Promise<Connection> {
    // FB Page tokens inherit from the user token; `refreshLongLivedToken`
    // returns a refreshed user token which we then use to re-fetch the Page
    // token — but in practice the Page token stays valid as long as the
    // user token does. For now we just refresh the token in place.
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

  async fetchFeed(_conn: Connection, _options: FeedOptions = {}): Promise<FeedItem[]> {
    // Phase 2: /{pageId}/feed?fields=id,message,permalink_url,created_time,full_picture
    throw new ProviderError({
      message:  'FacebookProvider.fetchFeed not implemented yet (phase 2).',
      code:     'not_implemented',
      platform: 'facebook',
    });
  }

  async fetchPostInsights(_platformPostId: string, _conn: Connection): Promise<PlatformInsights> {
    // Phase 2: /{postId}/insights?metric=post_impressions,post_engaged_users,post_reactions_by_type_total
    throw new ProviderError({
      message:  'FacebookProvider.fetchPostInsights not implemented yet (phase 2).',
      code:     'not_implemented',
      platform: 'facebook',
    });
  }

  async fetchAccountInsights(_conn: Connection, _range: DateRange): Promise<AccountInsights> {
    throw new ProviderError({
      message:  'FacebookProvider.fetchAccountInsights not implemented yet (phase 2).',
      code:     'not_implemented',
      platform: 'facebook',
    });
  }

  async fetchOptimalTimes(_conn: Connection): Promise<OptimalTime[]> {
    throw new ProviderError({
      message:  'FacebookProvider.fetchOptimalTimes not implemented yet (phase 2).',
      code:     'not_implemented',
      platform: 'facebook',
    });
  }

  private normalize(err: unknown): ProviderError {
    if (err instanceof ProviderError) return err;
    const msg = err instanceof Error ? err.message : String(err);

    if (err instanceof MetaGraphError) {
      if (err.code === 190) {
        return new ProviderError({
          message: msg, code: 'token_expired', platform: 'facebook',
          platformCode: String(err.code),
        });
      }
      if (err.code === 4 || err.code === 32 || err.code === 613) {
        return new ProviderError({
          message: msg, code: 'rate_limited', platform: 'facebook',
          retryable: true, platformCode: String(err.code),
        });
      }
      return new ProviderError({
        message: msg, code: 'platform_error', platform: 'facebook',
        retryable: err.retryable, platformCode: String(err.code),
      });
    }

    if (/fetch failed|ENOTFOUND|ETIMEDOUT|ECONNRESET/i.test(msg)) {
      return new ProviderError({ message: msg, code: 'network', platform: 'facebook', retryable: true });
    }
    return new ProviderError({ message: msg, code: 'platform_error', platform: 'facebook' });
  }
}

function composeCaption(caption: string, hashtags: string[]): string {
  // Facebook convention: hashtags are OK but fewer than on IG — we still
  // append them but the Copywriter should produce fewer for FB posts.
  const tagLine = hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ');
  return [caption, tagLine].filter(Boolean).join('\n\n').slice(0, MAX_CAPTION_LEN);
}
