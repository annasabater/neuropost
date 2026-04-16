// =============================================================================
// NEUROPOST — TikTok Content Posting API helpers
// Docs: https://developers.tiktok.com/doc/content-posting-api-get-started
// =============================================================================
// OAuth 2.0 + Content Posting API (video only — TikTok does not support images)
// Requires: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI
// =============================================================================

import { createHmac, randomBytes } from 'crypto';

const TT_AUTH_BASE  = 'https://www.tiktok.com';
const TT_API_BASE   = 'https://open.tiktokapis.com/v2';

function getRequiredEnv(name: 'TIKTOK_CLIENT_KEY' | 'TIKTOK_CLIENT_SECRET' | 'TIKTOK_REDIRECT_URI' | 'NEXTAUTH_SECRET'): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name} environment variable`);
  return value;
}

// ─── State (HMAC-signed) ─────────────────────────────────────────────────────

const enc = new TextEncoder();

export async function signTikTokState(userId: string): Promise<string> {
  const secret = enc.encode(getRequiredEnv('NEXTAUTH_SECRET'));
  const key    = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const ts     = Date.now().toString();
  const data   = `${userId}.tiktok.${ts}`;
  const sig    = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const sigB64 = Buffer.from(sig).toString('base64url');
  return Buffer.from(`${data}.${sigB64}`).toString('base64url');
}

export async function verifyTikTokState(state: string): Promise<{ userId: string }> {
  const decoded = Buffer.from(state, 'base64url').toString();
  const parts   = decoded.split('.');
  if (parts.length !== 4) throw new Error('Invalid TikTok state format');
  const [userId, platform, ts, sigB64] = parts;
  if (platform !== 'tiktok') throw new Error('Invalid TikTok state platform');
  if (Date.now() - parseInt(ts) > 30 * 60 * 1000) throw new Error('TikTok state expired');
  const secret   = enc.encode(getRequiredEnv('NEXTAUTH_SECRET'));
  const key      = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const sigBytes = Buffer.from(sigB64, 'base64url');
  const valid    = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(`${userId}.${platform}.${ts}`));
  if (!valid) throw new Error('Invalid TikTok state signature');
  return { userId };
}

// ─── OAuth ────────────────────────────────────────────────────────────────────

/** Builds TikTok OAuth URL with PKCE code verifier (stored in state). */
export function getTikTokAuthUrl(state: string): string {
  const clientKey  = getRequiredEnv('TIKTOK_CLIENT_KEY');
  const redirectUri = getRequiredEnv('TIKTOK_REDIRECT_URI');

  // Scopes requested:
  //   user.info.basic — identify the connected account
  //   video.upload    — upload videos as DRAFT (user finalizes in TikTok app)
  //
  // NOTE: `video.publish` (direct post, no manual confirmation) is a separate
  // scope that requires adding the Direct Post API product in the TikTok
  // Developer Portal AND is more restrictive in review. Re-add it to the
  // scope string once that product is approved for this app.
  const params = new URLSearchParams({
    client_key:    clientKey,
    scope:         'user.info.basic,video.upload',
    response_type: 'code',
    redirect_uri:  redirectUri,
    state,
  });

  return `${TT_AUTH_BASE}/v2/auth/authorize/?${params}`;
}

/** Exchanges authorization code for access + refresh tokens. */
export async function exchangeTikTokCode(code: string): Promise<{
  accessToken:  string;
  refreshToken: string;
  openId:       string;
  expiresIn:    number;
  refreshExpiresIn: number;
}> {
  const clientKey    = getRequiredEnv('TIKTOK_CLIENT_KEY');
  const clientSecret = getRequiredEnv('TIKTOK_CLIENT_SECRET');
  const redirectUri  = getRequiredEnv('TIKTOK_REDIRECT_URI');

  const body = new URLSearchParams({
    client_key:    clientKey,
    client_secret: clientSecret,
    code,
    grant_type:    'authorization_code',
    redirect_uri:  redirectUri,
  });

  const res  = await fetch(`${TT_API_BASE}/oauth/token/`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });
  const data = await res.json() as {
    data?: { access_token: string; refresh_token: string; open_id: string; expires_in: number; refresh_expires_in: number };
    error?: { code: string; message: string };
  };

  if (!res.ok || data.error) {
    throw new Error(`TikTok token exchange failed: ${data.error?.message ?? res.statusText}`);
  }

  const d = data.data!;
  return {
    accessToken:      d.access_token,
    refreshToken:     d.refresh_token,
    openId:           d.open_id,
    expiresIn:        d.expires_in,
    refreshExpiresIn: d.refresh_expires_in,
  };
}

/** Refreshes an expired TikTok access token using the refresh token. */
export async function refreshTikTokToken(refreshToken: string): Promise<{
  accessToken:  string;
  refreshToken: string;
  expiresIn:    number;
  refreshExpiresIn: number;
}> {
  const clientKey    = getRequiredEnv('TIKTOK_CLIENT_KEY');
  const clientSecret = getRequiredEnv('TIKTOK_CLIENT_SECRET');

  const body = new URLSearchParams({
    client_key:    clientKey,
    client_secret: clientSecret,
    grant_type:    'refresh_token',
    refresh_token: refreshToken,
  });

  const res  = await fetch(`${TT_API_BASE}/oauth/token/`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });
  const data = await res.json() as {
    data?: { access_token: string; refresh_token: string; expires_in: number; refresh_expires_in: number };
    error?: { code: string; message: string };
  };

  if (!res.ok || data.error) {
    throw new Error(`TikTok token refresh failed: ${data.error?.message ?? res.statusText}`);
  }

  const d = data.data!;
  return {
    accessToken:      d.access_token,
    refreshToken:     d.refresh_token,
    expiresIn:        d.expires_in,
    refreshExpiresIn: d.refresh_expires_in,
  };
}

/** Fetches TikTok user info (username, display name). */
export async function getTikTokUserInfo(accessToken: string, openId: string): Promise<{
  openId:      string;
  username:    string;
  displayName: string;
}> {
  const res  = await fetch(`${TT_API_BASE}/user/info/?fields=open_id,union_id,avatar_url,display_name,username`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json() as {
    data?: { user?: { open_id: string; display_name: string; username?: string } };
    error?: { code: string; message: string };
  };

  if (!res.ok || data.error) {
    throw new Error(`TikTok user info failed: ${data.error?.message ?? res.statusText}`);
  }

  const user = data.data?.user;
  return {
    openId:      user?.open_id ?? openId,
    username:    user?.username ?? user?.display_name ?? openId,
    displayName: user?.display_name ?? openId,
  };
}

// ─── Content Posting ──────────────────────────────────────────────────────────

export interface TikTokPublishResult {
  postId:      string;
  publishedAt: string;
}

/**
 * Publishes a video to TikTok via URL (Pull Upload).
 * The video must be publicly accessible (Supabase public URL).
 * TikTok does NOT support image posts via API — only videos.
 */
export async function publishVideoToTikTok({
  accessToken,
  videoUrl,
  caption,
  privacyLevel = 'PUBLIC_TO_EVERYONE',
  disableComment = false,
  disableDuet    = false,
  disableStitch  = false,
}: {
  accessToken:     string;
  videoUrl:        string;  // Publicly accessible MP4 URL
  caption:         string;
  privacyLevel?:   'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'FOLLOWER_OF_CREATOR' | 'SELF_ONLY';
  disableComment?: boolean;
  disableDuet?:    boolean;
  disableStitch?:  boolean;
}): Promise<TikTokPublishResult> {
  // Step 1 — Init pull upload (provide video URL, TikTok pulls it)
  //
  // We use the INBOX endpoint which requires only `video.upload` scope:
  // the video lands in the user's TikTok app inbox/drafts and THEY open
  // the app to add final caption, privacy and post it.
  // The Direct Post endpoint (/post/publish/video/init/) requires the
  // stricter `video.publish` scope — switch to that when it's approved.
  //
  // NOTE: the inbox endpoint does not accept `post_info` (title, privacy,
  // etc.) — those fields are set by the user in the TikTok app when they
  // finalize the post. We still generate the caption for copy-paste in
  // the post details shown in our dashboard.
  void caption; void privacyLevel;
  void disableComment; void disableDuet; void disableStitch;

  const initRes = await fetch(`${TT_API_BASE}/post/publish/inbox/video/init/`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type':  'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      source_info: {
        source:    'PULL_FROM_URL',
        video_url: videoUrl,
      },
    }),
  });

  const initData = await initRes.json() as {
    data?:  { publish_id: string };
    error?: { code: string; message: string; log_id: string };
  };

  if (!initRes.ok || initData.error?.code !== 'ok') {
    throw new Error(`TikTok video init failed: ${initData.error?.message ?? initRes.statusText}`);
  }

  const publishId = initData.data!.publish_id;

  // Step 2 — Poll for status until PUBLISH_COMPLETE or FAILED
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 5000));

    const statusRes = await fetch(`${TT_API_BASE}/post/publish/status/fetch/`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type':  'application/json; charset=UTF-8',
      },
      body: JSON.stringify({ publish_id: publishId }),
    });

    const statusData = await statusRes.json() as {
      data?:  { status: string; published_element_id?: string };
      error?: { code: string; message: string };
    };

    const status = statusData.data?.status;

    if (status === 'PUBLISH_COMPLETE') {
      return {
        postId:      statusData.data?.published_element_id ?? publishId,
        publishedAt: new Date().toISOString(),
      };
    }
    if (status === 'FAILED') {
      throw new Error(`TikTok publish failed for publish_id ${publishId}`);
    }
  }

  throw new Error('TikTok publish timed out after 100 seconds');
}
