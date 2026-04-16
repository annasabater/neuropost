// ─────────────────────────────────────────────────────────────────────────────
// NeuroPost — PlatformProvider interface
//
// Every concrete provider (instagram/, facebook/, tiktok/) implements this.
// Consumers (routes, crons, UI) get a provider via factory.getProvider(platform)
// and never import the concrete classes directly — that way adding a new
// platform is "add folder + register in factory" without touching callers.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Platform,
  PostFormat,
  NormalizedPost,
  Connection,
  PublishResult,
  ScheduleResult,
  FeedOptions,
  FeedItem,
  PlatformInsights,
  AccountInsights,
  OptimalTime,
  DateRange,
} from './types';

/** The contract every platform adapter fulfils. */
export interface PlatformProvider {
  readonly platform:         Platform;
  readonly supportedFormats: readonly PostFormat[];

  // ── Content publishing ──────────────────────────────────────────────────

  /**
   * Cheap synchronous check — does this provider accept this post at all?
   * Returns a discriminated union so callers can surface `reason` to users
   * without an exception in the happy/not-supported path.
   */
  canPublish(post: NormalizedPost): { ok: true } | { ok: false; reason: string };

  /** Publishes now. Throws ProviderError on remote failures. */
  publish(post: NormalizedPost, connection: Connection): Promise<PublishResult>;

  /**
   * Stores a scheduled publication. Default behaviour is app-side scheduling
   * via post_publications.scheduled_at (the publish-scheduled cron picks it
   * up). Override in providers that have native scheduling (Facebook Pages).
   */
  schedule?(
    post:        NormalizedPost,
    scheduledAt: Date,
    connection:  Connection,
  ): Promise<ScheduleResult>;

  // ── Auth ────────────────────────────────────────────────────────────────

  /** Refreshes access_token using refresh_token (or long-lived exchange for Meta). */
  refreshToken(connection: Connection): Promise<Connection>;

  // ── Reads ───────────────────────────────────────────────────────────────

  /** Fetches recent posts the brand published on this platform. */
  fetchFeed(connection: Connection, options?: FeedOptions): Promise<FeedItem[]>;

  /** Metrics for a single published post. */
  fetchPostInsights(platformPostId: string, connection: Connection): Promise<PlatformInsights>;

  /** Aggregate account metrics over a date range. */
  fetchAccountInsights(connection: Connection, range: DateRange): Promise<AccountInsights>;

  /** Per-platform optimal posting times derived from historical reach. */
  fetchOptimalTimes(connection: Connection): Promise<OptimalTime[]>;
}
