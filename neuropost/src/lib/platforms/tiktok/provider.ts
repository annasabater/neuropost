// ─────────────────────────────────────────────────────────────────────────────
// NeuroPost — TikTokProvider
// Wraps src/lib/tiktok.ts. Key constraints:
//   - Videos / Reels only (no photos or carousels)
//   - access_token expires every 24h, refresh_token every 365d (sliding)
//   - Inbox upload flow (video.upload scope) — user confirms in TikTok app
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
  publishVideoToTikTok,
  refreshTikTokToken,
  getTikTokUserInfo,
} from '@/lib/tiktok';

const SUPPORTED: readonly PostFormat[] = ['video', 'reel'] as const;

const MAX_CAPTION_LEN  = 2200;
const MIN_VIDEO_SEC    = 3;
const MAX_VIDEO_SEC    = 600;

export class TikTokProvider implements PlatformProvider {
  readonly platform         = 'tiktok' as const;
  readonly supportedFormats = SUPPORTED;

  canPublish(post: NormalizedPost) {
    if (!SUPPORTED.includes(post.format)) {
      return {
        ok: false as const,
        reason: 'TikTok solo admite vídeos / reels. Selecciona un post de formato video.',
      };
    }
    if (post.assets.length === 0) {
      return { ok: false as const, reason: 'TikTok necesita un asset de vídeo.' };
    }
    const asset = post.assets[0]!;
    if (asset.type !== 'video') {
      return { ok: false as const, reason: 'El asset debe ser un vídeo (MP4/MOV).' };
    }
    if (asset.durationSec != null) {
      if (asset.durationSec < MIN_VIDEO_SEC) {
        return { ok: false as const, reason: `Duración mínima ${MIN_VIDEO_SEC}s.` };
      }
      if (asset.durationSec > MAX_VIDEO_SEC) {
        return { ok: false as const, reason: `Duración máxima ${MAX_VIDEO_SEC}s.` };
      }
    }
    if ((post.caption?.length ?? 0) > MAX_CAPTION_LEN) {
      return { ok: false as const, reason: `Caption supera los ${MAX_CAPTION_LEN} caracteres.` };
    }
    return { ok: true as const };
  }

  async publish(post: NormalizedPost, conn: Connection): Promise<PublishResult> {
    const v = this.canPublish(post);
    if (!v.ok) throw new ProviderError({ message: v.reason, code: 'validation', platform: 'tiktok' });

    const caption = composeCaption(post.caption, post.hashtags);

    try {
      const r = await publishVideoToTikTok({
        accessToken: conn.accessToken,
        videoUrl:    post.assets[0]!.url,
        caption,
      });
      return {
        platformPostId:  r.postId,
        publishedAt:     new Date(r.publishedAt),
        metadata:        { publishId: r.postId },
      };
    } catch (err) {
      throw this.normalize(err);
    }
  }

  async refreshToken(conn: Connection): Promise<Connection> {
    if (!conn.refreshToken) {
      throw new ProviderError({
        message:  'TikTok connection has no refresh_token — user must reconnect.',
        code:     'token_expired',
        platform: 'tiktok',
      });
    }
    try {
      const r = await refreshTikTokToken(conn.refreshToken);
      return {
        ...conn,
        accessToken:      r.accessToken,
        refreshToken:     r.refreshToken || conn.refreshToken,
        expiresAt:        new Date(Date.now() + r.expiresIn * 1000),
        refreshExpiresAt: r.refreshExpiresIn > 0
          ? new Date(Date.now() + r.refreshExpiresIn * 1000)
          : conn.refreshExpiresAt,
      };
    } catch (err) {
      throw this.normalize(err);
    }
  }

  async fetchFeed(conn: Connection, options: FeedOptions = {}): Promise<FeedItem[]> {
    // TikTok Content Posting API doesn't expose a generic "my posts" feed
    // — we'd need to use the Research API (gated behind a separate TikTok
    // approval). For phase 1 we return the authenticated user's display
    // data only so the UI has *something* to render until phase 2 wires
    // /v2/video/query which requires video.list scope.
    void options;
    try {
      const user = await getTikTokUserInfo(conn.accessToken, conn.platformUserId);
      void user;
      return [];
    } catch (err) {
      throw this.normalize(err);
    }
  }

  async fetchPostInsights(_platformPostId: string, _conn: Connection): Promise<PlatformInsights> {
    // Phase 2: /v2/research/video/query/?fields=... (requires research API scope)
    throw new ProviderError({
      message:  'TikTokProvider.fetchPostInsights not implemented yet (phase 2).',
      code:     'not_implemented',
      platform: 'tiktok',
    });
  }

  async fetchAccountInsights(_conn: Connection, _range: DateRange): Promise<AccountInsights> {
    throw new ProviderError({
      message:  'TikTokProvider.fetchAccountInsights not implemented yet (phase 2).',
      code:     'not_implemented',
      platform: 'tiktok',
    });
  }

  async fetchOptimalTimes(_conn: Connection): Promise<OptimalTime[]> {
    throw new ProviderError({
      message:  'TikTokProvider.fetchOptimalTimes not implemented yet (phase 2).',
      code:     'not_implemented',
      platform: 'tiktok',
    });
  }

  private normalize(err: unknown): ProviderError {
    if (err instanceof ProviderError) return err;
    const msg = err instanceof Error ? err.message : String(err);

    if (/invalid_grant|access_token_invalid|refresh_token_invalid/i.test(msg)) {
      return new ProviderError({ message: msg, code: 'token_expired', platform: 'tiktok' });
    }
    if (/rate.?limit|too_many_requests/i.test(msg)) {
      return new ProviderError({ message: msg, code: 'rate_limited', platform: 'tiktok', retryable: true });
    }
    if (/fetch failed|ENOTFOUND|ETIMEDOUT|ECONNRESET/i.test(msg)) {
      return new ProviderError({ message: msg, code: 'network', platform: 'tiktok', retryable: true });
    }
    return new ProviderError({ message: msg, code: 'platform_error', platform: 'tiktok' });
  }
}

function composeCaption(caption: string, hashtags: string[]): string {
  // TikTok convention: hashtags inline with the caption, no \n break.
  const tagLine = hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ');
  return [caption, tagLine].filter(Boolean).join(' ').slice(0, MAX_CAPTION_LEN);
}
