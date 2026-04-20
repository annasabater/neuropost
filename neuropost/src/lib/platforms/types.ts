// ─────────────────────────────────────────────────────────────────────────────
// NeuroPost — Multi-platform abstraction: shared types
//
// Consumers: src/lib/platforms/provider.ts, every provider implementation,
// the routes in src/app/api/posts/publish/, and the UI.
// ─────────────────────────────────────────────────────────────────────────────

// Platform identifier. Must stay in sync with the CHECK constraint on
// platform_connections.platform and post_publications.platform.
export type Platform = 'instagram' | 'facebook' | 'tiktok';

// Canonical list — handy for .map / .includes without repeating the union.
export const ALL_PLATFORMS: readonly Platform[] = ['instagram', 'facebook', 'tiktok'] as const;

// The set of post formats the app understands. Not every platform supports
// every format — each PlatformProvider.supportedFormats narrows the subset.
export type PostFormat = 'foto' | 'carousel' | 'video' | 'reel' | 'story';

export interface MediaAsset {
  /** Publicly accessible URL — Supabase Storage public bucket in our case */
  url:           string;
  type:          'image' | 'video';
  /** Only populated for videos */
  durationSec?:  number;
  /** MIME type — useful for Facebook which wants it explicit */
  mime?:         string;
}

// A post ready to be handed to a provider. Already normalised + validated.
// The caption and hashtags may differ from the logical post in `posts` —
// each platform gets its own adapted version via post_publications.
export interface NormalizedPost {
  /** our internal posts.id */
  postId:        string;
  format:        PostFormat;
  caption:       string;
  hashtags:      string[];
  /** Single element for photo/video/reel/story, 2-10 for carousel */
  assets:        MediaAsset[];
  /** Platform-specific options (privacy level, first-comment hashtags, etc.) */
  metadata?:     Record<string, unknown>;
}

// Wraps a platform_connections row in a more TypeScript-friendly shape.
export interface Connection {
  id:                 string;
  brandId:            string;
  platform:           Platform;
  /** IG business account ID, FB page ID, TikTok open_id */
  platformUserId:     string;
  /** @handle, Page name, or TikTok display name — shown in UI */
  platformUsername:   string | null;
  accessToken:        string;
  /** Only TikTok uses a refresh token — Meta long-lived tokens self-refresh. */
  refreshToken:       string | null;
  expiresAt:          Date | null;
  refreshExpiresAt:   Date | null;
  status:             'active' | 'expired' | 'revoked' | 'error';
  /** Platform-specific extras (FB page id attached to an IG connection, TikTok avatar URL, etc.) */
  metadata:           Record<string, unknown>;
}

export interface PublishResult {
  /** The ID the platform assigned (IG media id, FB post id, TikTok video id) */
  platformPostId:    string;
  /** Deep link to the published post — may be missing on some platforms */
  platformPostUrl?:  string;
  publishedAt:       Date;
  /** Per-platform bookkeeping (TikTok publish_id, FB photo_id, etc.) */
  metadata?:         Record<string, unknown>;
}

/**
 * For platforms without native scheduling (TikTok, Instagram basic Graph API)
 * the app schedules in-DB via post_publications.scheduled_at and the
 * publish-scheduled cron. Facebook Pages API supports native scheduling,
 * but we keep everything app-side for consistency.
 */
export interface ScheduleResult {
  postId:       string;
  scheduledAt:  Date;
}

export interface FeedOptions {
  limit?:  number;
  since?:  Date;
  until?:  Date;
}

export interface FeedItem {
  platformPostId:   string;
  publishedAt:      Date;
  type:             'image' | 'video' | 'carousel' | 'reel';
  caption:          string | null;
  thumbnailUrl:     string | null;
  permalink:        string | null;
  likeCount?:       number;
  commentCount?:    number;
}

// ── Insights ──────────────────────────────────────────────────────────────
// Deliberately not unified — each platform keeps its native metric names.
// Callers narrow via the `platform` discriminator.

export type PlatformInsights =
  | ({ platform: 'instagram' } & InstagramInsights)
  | ({ platform: 'facebook'  } & FacebookInsights)
  | ({ platform: 'tiktok'    } & TikTokInsights);

export interface InstagramInsights {
  reach:             number;
  impressions:       number;
  likes:             number;
  comments:          number;
  saves:             number;
  shares:            number;
  videoViews?:       number;
  avgWatchTimeSec?:  number;
}

export interface FacebookInsights {
  reach:             number;
  impressions:       number;
  reactions:         number;
  comments:          number;
  shares:            number;
  videoViews?:       number;
  avgWatchTimeSec?:  number;
}

export interface TikTokInsights {
  videoViews:        number;
  likes:             number;
  comments:          number;
  shares:            number;
  avgWatchTimeSec?:  number;
  completionRate?:   number;
  forYouImpressions?:number;
  searchImpressions?:number;
}

// Account-level / date-range aggregates — also platform-native shapes.
export type AccountInsights =
  | ({ platform: 'instagram' } & InstagramAccountInsights)
  | ({ platform: 'facebook'  } & FacebookAccountInsights)
  | ({ platform: 'tiktok'    } & TikTokAccountInsights);

export interface InstagramAccountInsights {
  followers:          number;
  followerGrowth:     number;
  totalReach:         number;
  totalImpressions:   number;
  avgEngagementRate:  number;
  topPosts:           Array<{ platformPostId: string; reach: number; engagement: number }>;
}

export interface FacebookAccountInsights {
  pageFollowers:      number;
  pageLikes:          number;
  pageReach:          number;
  pageImpressions:    number;
  engagedUsers:       number;
}

export interface TikTokAccountInsights {
  followers:          number;
  totalVideoViews:    number;
  avgWatchTime:       number;
  profileVisits:      number;
}

export interface OptimalTime {
  dayOfWeek:   number;   // 0 = Sunday … 6 = Saturday
  hour:        number;   // 0 … 23
  avgReach:    number;
  sampleSize:  number;
}

export interface DateRange {
  from: Date;
  to:   Date;
}

// ── Errors ────────────────────────────────────────────────────────────────
// Providers throw ProviderError for predictable failures so callers can
// decide retry / escalate / surface-to-user. Anything else bubbles as a
// native Error and is treated as a platform bug.

export type ProviderErrorCode =
  | 'unsupported_format'   // e.g. photo on TikTok
  | 'missing_asset'        // no image/video provided
  | 'invalid_asset'        // wrong ratio, too long, etc.
  | 'token_expired'        // caller should reconnect
  | 'rate_limited'         // retry with backoff
  | 'platform_error'       // remote API returned 4xx/5xx not otherwise classified
  | 'network'              // transport-level failure
  | 'validation'           // local validation failed (caption too long, etc.)
  | 'not_implemented';     // provider method not yet wired (phase-2 stub)

export class ProviderError extends Error {
  readonly code:         ProviderErrorCode;
  readonly platform:    Platform;
  readonly retryable:    boolean;
  readonly platformCode: string | undefined;

  constructor(opts: {
    message:       string;
    code:          ProviderErrorCode;
    platform:      Platform;
    retryable?:    boolean;
    platformCode?: string;
  }) {
    super(opts.message);
    this.name         = 'ProviderError';
    this.code         = opts.code;
    this.platform     = opts.platform;
    this.retryable    = opts.retryable ?? false;
    this.platformCode = opts.platformCode;
  }
}
