// =============================================================================
// NEUROPOST — Meta Graph API helpers (Instagram + Facebook)
// Docs: https://developers.facebook.com/docs/graph-api
// =============================================================================

import { createHmac } from 'crypto';

const GRAPH_BASE = 'https://graph.facebook.com/v19.0';

// ─── Error ────────────────────────────────────────────────────────────────────

export class MetaGraphError extends Error {
  constructor(
    message:          string,
    public code:      number,
    public subcode?:  number,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = 'MetaGraphError';
  }
}

const RETRYABLE_CODES = new Set([1, 2, 4, 17, 341]);

function parseMetaError(body: Record<string, unknown>): MetaGraphError {
  const err = (body.error ?? body) as { message?: string; code?: number; error_subcode?: number };
  const code    = err.code ?? 0;
  const subcode = err.error_subcode;
  const msg     = err.message ?? 'Meta Graph API error';
  return new MetaGraphError(msg, code, subcode, RETRYABLE_CODES.has(code));
}

// ─── Generic fetch wrapper ────────────────────────────────────────────────────

async function graphFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res  = await fetch(`${GRAPH_BASE}/${path}`, options);
  const body = await res.json() as Record<string, unknown>;

  if (!res.ok || body.error) throw parseMetaError(body);
  return body as T;
}

// ─── OAuth state (HMAC-SHA256 signed, URL-safe base64) ───────────────────────

const enc = new TextEncoder();

export async function signMetaState(userId: string): Promise<string> {
  const secret = enc.encode(process.env.NEXTAUTH_SECRET ?? 'neuropost-secret-key');
  const key    = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const ts     = Date.now().toString();
  const data   = `${userId}.${ts}`;
  const sig    = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const sigB64 = Buffer.from(sig).toString('base64url');
  return Buffer.from(`${data}.${sigB64}`).toString('base64url');
}

export async function verifyMetaState(state: string): Promise<string> {
  const decoded = Buffer.from(state, 'base64url').toString();
  const dots    = decoded.split('.');
  if (dots.length !== 3) throw new Error('Invalid state format');
  const [userId, ts, sigB64] = dots;
  if (Date.now() - parseInt(ts) > 30 * 60 * 1000) throw new Error('State expired');
  const secret   = enc.encode(process.env.NEXTAUTH_SECRET ?? 'neuropost-secret-key');
  const key      = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const sigBytes = Buffer.from(sigB64, 'base64url');
  const valid    = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(`${userId}.${ts}`));
  if (!valid) throw new Error('Invalid state signature');
  return userId;
}

// ─── Webhook signature verification ──────────────────────────────────────────

export function verifyMetaWebhookSignature(payload: string, signature: string): boolean {
  const appSecret = process.env.META_APP_SECRET ?? '';
  const expected  = `sha256=${createHmac('sha256', appSecret).update(payload).digest('hex')}`;
  // Constant-time comparison to prevent timing attacks
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

// ─── OAuth helpers ────────────────────────────────────────────────────────────

export function getOAuthUrl(state: string): string {
  const appId       = process.env.META_APP_ID       ?? '';
  const redirectUri = process.env.META_REDIRECT_URI ?? '';

  const params = new URLSearchParams({
    client_id:     appId,
    redirect_uri:  redirectUri,
    scope:         [
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_comments',
      'instagram_manage_insights',
      'pages_show_list',
      'pages_manage_posts',
      'pages_read_engagement',
      'pages_manage_metadata',
      'pages_messaging',
    ].join(','),
    response_type: 'code',
    state,
  });

  return `https://www.facebook.com/v19.0/dialog/oauth?${params}`;
}

export async function exchangeCodeForToken(code: string): Promise<{ accessToken: string; expiresIn: number }> {
  const appId       = process.env.META_APP_ID       ?? '';
  const appSecret   = process.env.META_APP_SECRET   ?? '';
  const redirectUri = process.env.META_REDIRECT_URI ?? '';

  const result = await graphFetch<{ access_token: string; expires_in: number }>(
    `oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`,
  );

  return { accessToken: result.access_token, expiresIn: result.expires_in };
}

export async function getLongLivedToken(shortToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const appId     = process.env.META_APP_ID     ?? '';
  const appSecret = process.env.META_APP_SECRET ?? '';

  const result = await graphFetch<{ access_token: string; expires_in: number }>(
    `oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`,
  );

  return { accessToken: result.access_token, expiresIn: result.expires_in };
}

export async function refreshLongLivedToken(currentToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  return getLongLivedToken(currentToken);
}

// ─── Pages & IG account discovery ────────────────────────────────────────────

export interface FacebookPage {
  id:           string;
  name:         string;
  access_token: string;
}

export interface IGBusinessAccount {
  id:        string;
  username?: string;
}

export async function getFacebookPages(userAccessToken: string): Promise<FacebookPage[]> {
  const result = await graphFetch<{ data: FacebookPage[] }>(
    `me/accounts?access_token=${userAccessToken}&fields=id,name,access_token`,
  );
  return result.data ?? [];
}

export async function getIGAccountFromPage(pageId: string, pageToken: string): Promise<IGBusinessAccount | null> {
  const result = await graphFetch<{ instagram_business_account?: IGBusinessAccount }>(
    `${pageId}?fields=instagram_business_account%7Bid%2Cusername%7D&access_token=${pageToken}`,
  );
  return result.instagram_business_account ?? null;
}

// ─── Container polling ────────────────────────────────────────────────────────

async function pollContainerStatus(containerId: string, accessToken: string): Promise<void> {
  for (let i = 0; i < 10; i++) {
    const result = await graphFetch<{ status_code: string }>(
      `${containerId}?fields=status_code&access_token=${accessToken}`,
    );
    if (result.status_code === 'FINISHED') return;
    if (result.status_code === 'ERROR') throw new MetaGraphError('Instagram media container processing failed', 0);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new MetaGraphError('Instagram media container timed out', 0);
}

// ─── Instagram Publishing ─────────────────────────────────────────────────────

export interface MetaPublishResult {
  postId:      string;
  permalink:   string;
  publishedAt: string;
}

export async function publishToInstagram({
  igAccountId,
  imageUrl,
  caption,
  accessToken,
  altText,
}: {
  igAccountId:  string;
  imageUrl:     string;
  caption:      string;
  accessToken:  string;
  altText?:     string;
}): Promise<MetaPublishResult> {
  // Step 1 — Create media container
  const container = await graphFetch<{ id: string }>(
    `${igAccountId}/media`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        image_url:   imageUrl,
        caption,
        access_token: accessToken,
        ...(altText ? { alt_text: altText } : {}),
      }),
    },
  );

  // Step 2 — Wait for container to be ready
  await pollContainerStatus(container.id, accessToken);

  // Step 3 — Publish container
  const published = await graphFetch<{ id: string }>(
    `${igAccountId}/media_publish`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ creation_id: container.id, access_token: accessToken }),
    },
  );

  // Step 4 — Fetch permalink
  const media = await graphFetch<{ permalink: string }>(
    `${published.id}?fields=permalink&access_token=${accessToken}`,
  );

  return { postId: published.id, permalink: media.permalink, publishedAt: new Date().toISOString() };
}

export async function publishReelToInstagram({
  igAccountId,
  videoUrl,
  caption,
  accessToken,
  shareToFeed = true,
}: {
  igAccountId:  string;
  videoUrl:     string;     // publicly accessible MP4 URL (Supabase public URL)
  caption:      string;
  accessToken:  string;
  shareToFeed?: boolean;
}): Promise<MetaPublishResult> {
  // Step 1 — Create Reel container (video processing is async on Meta's side)
  const container = await graphFetch<{ id: string }>(
    `${igAccountId}/media`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        media_type:    'REELS',
        video_url:     videoUrl,
        caption,
        share_to_feed: shareToFeed,
        access_token:  accessToken,
      }),
    },
  );

  // Step 2 — Poll until container is FINISHED (video encoding takes ~30–90 s)
  await pollContainerStatus(container.id, accessToken);

  // Step 3 — Publish the container
  const published = await graphFetch<{ id: string }>(
    `${igAccountId}/media_publish`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ creation_id: container.id, access_token: accessToken }),
    },
  );

  // Step 4 — Fetch permalink
  const media = await graphFetch<{ permalink: string }>(
    `${published.id}?fields=permalink&access_token=${accessToken}`,
  );

  return { postId: published.id, permalink: media.permalink, publishedAt: new Date().toISOString() };
}

export async function publishStoryToInstagram({
  igAccountId,
  imageUrl,
  accessToken,
}: {
  igAccountId:  string;
  imageUrl:     string;
  accessToken:  string;
}): Promise<MetaPublishResult> {
  // Step 1 — Create story container (no caption on stories)
  const container = await graphFetch<{ id: string }>(
    `${igAccountId}/media`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ image_url: imageUrl, media_type: 'STORIES', access_token: accessToken }),
    },
  );

  // Step 2 — Wait for container
  await pollContainerStatus(container.id, accessToken);

  // Step 3 — Publish
  const published = await graphFetch<{ id: string }>(
    `${igAccountId}/media_publish`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ creation_id: container.id, access_token: accessToken }),
    },
  );

  return { postId: published.id, permalink: '', publishedAt: new Date().toISOString() };
}

// ─── Facebook Publishing ──────────────────────────────────────────────────────

export async function publishToFacebook({
  pageId,
  imageUrl,
  caption,
  accessToken,
}: {
  pageId:      string;
  imageUrl:    string;
  caption:     string;
  accessToken: string;
}): Promise<MetaPublishResult> {
  const result = await graphFetch<{ id: string; post_id?: string }>(
    `${pageId}/photos`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ url: imageUrl, message: caption, access_token: accessToken, published: true }),
    },
  );

  const postId    = result.post_id ?? result.id;
  const permalink = `https://www.facebook.com/${postId.replace('_', '/posts/')}`;

  return { postId, permalink, publishedAt: new Date().toISOString() };
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export interface MetaComment {
  id:        string;
  text:      string;
  username:  string;
  timestamp: string;
}

export async function getIGComments(igPostId: string, accessToken: string): Promise<MetaComment[]> {
  const result = await graphFetch<{ data: MetaComment[] }>(
    `${igPostId}/comments?fields=id,text,username,timestamp&access_token=${accessToken}`,
  );
  return result.data ?? [];
}

export async function replyToComment({
  commentId,
  message,
  accessToken,
}: {
  commentId:   string;
  message:     string;
  accessToken: string;
}): Promise<{ replyId: string }> {
  const result = await graphFetch<{ id: string }>(
    `${commentId}/replies`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message, access_token: accessToken }),
    },
  );
  return { replyId: result.id };
}

export async function sendDmReply({
  recipientId,
  message,
  pageId,
  accessToken,
}: {
  recipientId: string;
  message:     string;
  pageId:      string;
  accessToken: string;
}): Promise<{ messageId: string }> {
  const result = await graphFetch<{ message_id: string }>(
    `${pageId}/messages`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        recipient:    { id: recipientId },
        message:      { text: message },
        access_token: accessToken,
      }),
    },
  );
  return { messageId: result.message_id };
}

// ─── Insights ─────────────────────────────────────────────────────────────────

export interface IGPostInsights {
  impressions: number;
  reach:       number;
  likes:       number;
  comments:    number;
  saved:       number;
  shares:      number;
}

// ─── Like a comment (prospects' replies to our outbound comments) ─────────────

export async function likeIGComment(commentId: string, accessToken: string): Promise<void> {
  await graphFetch<{ success: boolean }>(
    `${commentId}/likes`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ access_token: accessToken }),
    },
  );
}

// ─── Conversations (DMs received) ────────────────────────────────────────────

export interface IGConversationMessage {
  id:           string;
  message:      string;
  from:         { id: string; name?: string; username?: string };
  created_time: string;
}

export interface IGConversation {
  id:       string;
  messages: { data: IGConversationMessage[] };
}

export async function getIGConversations(igAccountId: string, accessToken: string): Promise<IGConversation[]> {
  const result = await graphFetch<{ data: IGConversation[] }>(
    `${igAccountId}/conversations?fields=id,messages%7Bid%2Cmessage%2Cfrom%2Ccreated_time%7D&access_token=${accessToken}`,
  );
  return result.data ?? [];
}

export async function sendIGDM({
  igAccountId,
  recipientId,
  message,
  accessToken,
}: {
  igAccountId:  string;
  recipientId:  string;
  message:      string;
  accessToken:  string;
}): Promise<{ messageId: string }> {
  const result = await graphFetch<{ message_id: string }>(
    `${igAccountId}/messages`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        recipient:    { id: recipientId },
        message:      { text: message },
        access_token: accessToken,
      }),
    },
  );
  return { messageId: result.message_id };
}

// ─── Insights ─────────────────────────────────────────────────────────────────

export async function getIGPostInsights(igPostId: string, accessToken: string): Promise<IGPostInsights> {
  const result = await graphFetch<{ data: { name: string; values: { value: number }[] }[] }>(
    `${igPostId}/insights?metric=impressions,reach,likes_count,comments_count,saved,shares&access_token=${accessToken}`,
  );

  const map: Record<string, number> = {};
  for (const metric of result.data ?? []) {
    map[metric.name] = metric.values?.[0]?.value ?? 0;
  }

  return {
    impressions: map.impressions       ?? 0,
    reach:       map.reach             ?? 0,
    likes:       map.likes_count       ?? 0,
    comments:    map.comments_count    ?? 0,
    saved:       map.saved             ?? 0,
    shares:      map.shares            ?? 0,
  };
}
