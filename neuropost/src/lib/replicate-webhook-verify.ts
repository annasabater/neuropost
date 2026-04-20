// =============================================================================
// Replicate webhook signature verification (Standard Webhooks / Svix)
// =============================================================================
// Replicate sends three headers per the Standard Webhooks spec:
//   webhook-id        unique message id
//   webhook-timestamp unix seconds
//   webhook-signature "v1,<base64sig> v1,<base64sig>"   (space-separated)
//
// Signed payload: `${id}.${timestamp}.${body}` — HMAC-SHA256 with the
// base64-decoded secret (the part after the `whsec_` prefix).
//
// The full raw body string must be used — not the parsed JSON.
// =============================================================================

import { createHmac, timingSafeEqual } from 'node:crypto';

export type VerifyResult =
  | { ok: true }
  | { ok: false; status: 401 | 400; reason: string };

const MAX_AGE_SECONDS = 5 * 60;

function decodeSecret(raw: string): Buffer {
  const clean = raw.startsWith('whsec_') ? raw.slice('whsec_'.length) : raw;
  return Buffer.from(clean, 'base64');
}

function constantTimeEq(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function verifyReplicateWebhook(
  rawBody: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string | undefined,
): VerifyResult {
  if (!secret) {
    return { ok: false, status: 401, reason: 'REPLICATE_WEBHOOK_SECRET not configured' };
  }
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) {
    return { ok: false, status: 401, reason: 'Missing webhook headers' };
  }

  // Replay protection
  const ts = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) {
    return { ok: false, status: 400, reason: 'Malformed timestamp' };
  }
  const age = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (age > MAX_AGE_SECONDS) {
    return { ok: false, status: 401, reason: `Timestamp outside tolerance (${age}s)` };
  }

  // Compute expected signature
  const signed = `${id}.${timestamp}.${rawBody}`;
  const key = decodeSecret(secret);
  const expected = createHmac('sha256', key).update(signed).digest('base64');

  // Header may contain multiple "v1,<sig>" tokens separated by spaces
  const received = signature.split(' ')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => (s.startsWith('v1,') ? s.slice(3) : s));

  const match = received.some(sig => constantTimeEq(sig, expected));
  if (!match) return { ok: false, status: 401, reason: 'Invalid signature' };

  return { ok: true };
}

const ALLOWED_IMAGE_PREFIXES = [
  'https://replicate.delivery/',
  'https://pbxt.replicate.delivery/',
] as const;

export function isAllowedReplicateImageUrl(url: string): boolean {
  return ALLOWED_IMAGE_PREFIXES.some(prefix => url.startsWith(prefix));
}
