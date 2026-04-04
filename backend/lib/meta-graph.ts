// ─────────────────────────────────────────────────────────────────────────────
// Postly — Meta Graph API wrapper
// Covers the two publish flows used by PublisherAgent:
//   • Instagram: container creation → poll ready → publish
//   • Facebook:  single photos/feed endpoint
//
// Requires Node 18+ (native fetch).
// ─────────────────────────────────────────────────────────────────────────────

const GRAPH_BASE = 'https://graph.facebook.com/v19.0';

/** Milliseconds between container-ready polls */
const INSTAGRAM_POLL_INTERVAL_MS = 2_000;
/** Maximum polls before giving up */
const INSTAGRAM_POLL_MAX_ATTEMPTS = 15;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MetaPublishParams {
  accessToken: string;
  /** Instagram user ID or Facebook Page ID */
  accountId: string;
  /** Public CDN URL of the final image */
  imageUrl: string;
  /** Full caption + hashtags string, already assembled by the caller */
  caption: string;
  /** Alt-text for accessibility (Instagram only) */
  altText?: string;
}

export interface MetaPublishResult {
  /** Meta post/media ID */
  postId: string;
  /** Direct permalink to the post */
  permalink: string;
  publishedAt: string;
}

export class MetaGraphError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly subcode?: number,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'MetaGraphError';
  }
}

// ─── Instagram (3-step container flow) ───────────────────────────────────────

/**
 * Publishes an image post to an Instagram Business account.
 *
 * Flow:
 * 1. POST /igUserId/media          → creates media container
 * 2. GET  /containerId?fields=status_code  → poll until FINISHED
 * 3. POST /igUserId/media_publish  → publishes the container
 *
 * @throws MetaGraphError on API errors
 */
export async function publishToInstagram(params: MetaPublishParams): Promise<MetaPublishResult> {
  // Step 1 — create container
  const createRes = await graphPost(`/${params.accountId}/media`, {
    image_url: params.imageUrl,
    caption: params.caption,
    ...(params.altText ? { alt_text: params.altText } : {}),
    access_token: params.accessToken,
  });

  const containerId = createRes.id as string;

  // Step 2 — poll until FINISHED
  await pollContainerReady(containerId, params.accessToken);

  // Step 3 — publish
  const publishRes = await graphPost(`/${params.accountId}/media_publish`, {
    creation_id: containerId,
    access_token: params.accessToken,
  });

  const postId = publishRes.id as string;
  const permalink = await fetchInstagramPermalink(postId, params.accessToken);

  return {
    postId,
    permalink,
    publishedAt: new Date().toISOString(),
  };
}

// ─── Facebook (single-call flow) ─────────────────────────────────────────────

/**
 * Publishes an image post to a Facebook Page.
 *
 * Uses the /photos endpoint which handles upload + post atomically.
 *
 * @throws MetaGraphError on API errors
 */
export async function publishToFacebook(params: MetaPublishParams): Promise<MetaPublishResult> {
  const res = await graphPost(`/${params.accountId}/photos`, {
    url: params.imageUrl,
    message: params.caption,
    access_token: params.accessToken,
  });

  const postId = res.post_id as string ?? res.id as string;

  return {
    postId,
    permalink: `https://www.facebook.com/${postId}`,
    publishedAt: new Date().toISOString(),
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function graphPost(path: string, body: Record<string, string>): Promise<Record<string, unknown>> {
  const url = `${GRAPH_BASE}${path}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as Record<string, unknown>;
  assertNoGraphError(data);
  return data;
}

async function graphGet(
  path: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams(params).toString();
  const response = await fetch(`${GRAPH_BASE}${path}?${qs}`);
  const data = (await response.json()) as Record<string, unknown>;
  assertNoGraphError(data);
  return data;
}

async function pollContainerReady(containerId: string, accessToken: string): Promise<void> {
  for (let attempt = 0; attempt < INSTAGRAM_POLL_MAX_ATTEMPTS; attempt++) {
    await sleep(INSTAGRAM_POLL_INTERVAL_MS);

    const data = await graphGet(`/${containerId}`, {
      fields: 'status_code,status',
      access_token: accessToken,
    });

    const statusCode = data.status_code as string;

    if (statusCode === 'FINISHED') return;
    if (statusCode === 'ERROR' || statusCode === 'EXPIRED') {
      throw new MetaGraphError(
        `Instagram container failed with status: ${statusCode}`,
        400,
        undefined,
        false,
      );
    }
    // IN_PROGRESS — keep polling
  }

  throw new MetaGraphError(
    `Instagram container not ready after ${INSTAGRAM_POLL_MAX_ATTEMPTS} attempts`,
    408,
    undefined,
    true,
  );
}

async function fetchInstagramPermalink(postId: string, accessToken: string): Promise<string> {
  try {
    const data = await graphGet(`/${postId}`, {
      fields: 'permalink',
      access_token: accessToken,
    });
    return (data.permalink as string) ?? `https://www.instagram.com/p/${postId}`;
  } catch {
    // Non-critical — fall back to constructed URL
    return `https://www.instagram.com/p/${postId}`;
  }
}

function assertNoGraphError(data: Record<string, unknown>): void {
  if (!data.error) return;

  const err = data.error as Record<string, unknown>;
  const code = (err.code as number) ?? 0;
  const subcode = err.error_subcode as number | undefined;
  const message = (err.message as string) ?? 'Unknown Meta Graph API error';

  // Retryable: rate limits (code 4, 17, 32) and temporary errors (code 2)
  const retryable = [2, 4, 17, 32].includes(code);

  throw new MetaGraphError(message, code, subcode, retryable);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Insights / analytics endpoints ──────────────────────────────────────────

/** Metrics available for a single published post */
export interface PostInsights {
  postId: string;
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  /** Saves — Instagram only; 0 for Facebook */
  saves: number;
  /** Pre-computed: (likes + comments + shares + saves) / reach * 100 */
  engagementRate: number;
}

/** Account-level metrics for a period */
export interface AccountInsights {
  followersCount: number;
  profileVisits: number;
  websiteClicks: number;
  totalReach: number;
  totalImpressions: number;
}

/**
 * Fetches insights for a single Instagram or Facebook post.
 * Instagram uses the /media/{id}/insights endpoint.
 * Facebook uses the /{post-id}/insights endpoint.
 */
export async function fetchPostInsights(
  postId: string,
  platform: 'instagram' | 'facebook',
  accessToken: string,
): Promise<PostInsights> {
  const metrics =
    platform === 'instagram'
      ? 'reach,impressions,likes,comments,shares,saved'
      : 'post_impressions_unique,post_impressions,post_reactions_by_type_total,post_clicks,post_activity';

  const path = platform === 'instagram' ? `/${postId}/insights` : `/${postId}/insights`;

  const data = await graphGet(path, {
    metric: metrics,
    access_token: accessToken,
  });

  return parsePostInsights(postId, platform, data);
}

/**
 * Fetches account-level analytics for an Instagram Business or Facebook Page.
 *
 * @param accountId  Instagram user ID or Facebook Page ID
 * @param since      ISO date string — start of period
 * @param until      ISO date string — end of period
 */
export async function fetchAccountInsights(
  accountId: string,
  platform: 'instagram' | 'facebook',
  accessToken: string,
  since: string,
  until: string,
): Promise<AccountInsights> {
  const metrics =
    platform === 'instagram'
      ? 'reach,profile_views,website_clicks,follower_count'
      : 'page_impressions_unique,page_views_total,page_website_clicks';

  const data = await graphGet(`/${accountId}/insights`, {
    metric: metrics,
    period: 'day',
    since,
    until,
    access_token: accessToken,
  });

  return parseAccountInsights(platform, data);
}

function parsePostInsights(
  postId: string,
  platform: 'instagram' | 'facebook',
  data: Record<string, unknown>,
): PostInsights {
  // Meta returns { data: [{ name, values: [{ value }] }] }
  const metrics = extractMetricValues(data);

  const reach = metrics['reach'] ?? metrics['post_impressions_unique'] ?? 0;
  const impressions = metrics['impressions'] ?? metrics['post_impressions'] ?? 0;
  const likes = metrics['likes'] ?? 0;
  const comments = metrics['comments'] ?? 0;
  const shares = metrics['shares'] ?? 0;
  const saves = platform === 'instagram' ? (metrics['saved'] ?? 0) : 0;
  const engagementRate = reach > 0 ? ((likes + comments + shares + saves) / reach) * 100 : 0;

  return { postId, reach, impressions, likes, comments, shares, saves, engagementRate };
}

function parseAccountInsights(
  platform: 'instagram' | 'facebook',
  data: Record<string, unknown>,
): AccountInsights {
  const metrics = extractMetricValues(data);

  return {
    followersCount: metrics['follower_count'] ?? 0,
    profileVisits: metrics['profile_views'] ?? metrics['page_views_total'] ?? 0,
    websiteClicks: metrics['website_clicks'] ?? metrics['page_website_clicks'] ?? 0,
    totalReach: metrics['reach'] ?? metrics['page_impressions_unique'] ?? 0,
    totalImpressions: metrics['impressions'] ?? 0,
  };
}

function extractMetricValues(data: Record<string, unknown>): Record<string, number> {
  const result: Record<string, number> = {};
  const items = (data.data as Array<Record<string, unknown>>) ?? [];
  for (const item of items) {
    const name = item.name as string;
    const values = item.values as Array<Record<string, unknown>> | undefined;
    const value = values?.[0]?.value;
    result[name] = typeof value === 'number' ? value : 0;
  }
  return result;
}

// ─── Community reply endpoints ────────────────────────────────────────────────

export interface MetaReplyParams {
  accessToken: string;
  /** Meta comment ID to reply to */
  commentId: string;
  message: string;
}

export interface MetaDmReplyParams {
  accessToken: string;
  /** Instagram/Messenger recipient user ID */
  recipientId: string;
  message: string;
  /** Instagram Business account ID (required for IG Messaging API) */
  igAccountId?: string;
}

export interface MetaReplyResult {
  replyId: string;
  postedAt: string;
}

/**
 * Posts a reply to a comment on Instagram or Facebook.
 * Works for both platforms — the endpoint is the same.
 */
export async function replyToComment(params: MetaReplyParams): Promise<MetaReplyResult> {
  const res = await graphPost(`/${params.commentId}/replies`, {
    message: params.message,
    access_token: params.accessToken,
  });

  return {
    replyId: res.id as string,
    postedAt: new Date().toISOString(),
  };
}

/**
 * Sends a DM reply via Instagram Messaging API or Facebook Messenger.
 * Requires the page/account to have messaging permissions granted.
 */
export async function sendDmReply(params: MetaDmReplyParams): Promise<MetaReplyResult> {
  const endpoint = params.igAccountId
    ? `/${params.igAccountId}/messages`
    : '/me/messages';

  const res = await graphPost(endpoint, {
    recipient: JSON.stringify({ id: params.recipientId }),
    message: JSON.stringify({ text: params.message }),
    access_token: params.accessToken,
  });

  return {
    replyId: (res.message_id ?? res.id) as string,
    postedAt: new Date().toISOString(),
  };
}
