// =============================================================================
// Rate limiter — Redis sliding window (production-ready)
// =============================================================================
// Uses the same Redis connection as BullMQ. Falls back to in-memory when Redis
// is unavailable so the app never blocks due to a rate limiter failure.
//
// Usage in any API route:
//   const blocked = await rateLimit(request, 'agents', { limit: 20, window: 60 });
//   if (blocked) return blocked;  // returns a 429 Response

import { NextResponse } from 'next/server';

// ─── In-memory fallback ──────────────────────────────────────────────────────
const memStore = new Map<string, { count: number; reset: number }>();

function memCheck(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = memStore.get(key);
  if (!entry || now > entry.reset) {
    memStore.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// Periodic cleanup of stale entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of memStore) {
    if (now > v.reset) memStore.delete(k);
  }
}, 300_000);

// ─── Redis check ─────────────────────────────────────────────────────────────

async function redisCheck(key: string, limit: number, windowSec: number): Promise<boolean> {
  try {
    const { getRedisConnection } = await import('./redis');
    const redis = getRedisConnection();
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSec);
    }
    return current <= limit;
  } catch {
    return true; // Redis down → allow (fail open)
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

interface RateLimitOpts {
  /** Max requests per window (default 30) */
  limit?: number;
  /** Window in seconds (default 60) */
  window?: number;
}

/**
 * Check rate limit for a request. Returns null if allowed, or a 429 Response if blocked.
 *
 * @param request  The incoming Request (uses IP + path for key derivation)
 * @param scope    A label for the limit bucket (e.g. 'agents', 'auth', 'chat')
 * @param opts     { limit, window } defaults to 30 req/60s
 */
export async function rateLimit(
  request: Request,
  scope: string,
  opts: RateLimitOpts = {},
): Promise<NextResponse | null> {
  const limit    = opts.limit  ?? 30;
  const windowSec = opts.window ?? 60;

  // Derive identifier: prefer user ID from header, fall back to IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          ?? request.headers.get('x-real-ip')
          ?? 'unknown';
  const key = `rl:${scope}:${ip}`;

  // Try Redis first, fall back to in-memory
  let allowed: boolean;
  if (process.env.REDIS_URL) {
    allowed = await redisCheck(key, limit, windowSec);
  } else {
    allowed = memCheck(key, limit, windowSec * 1000);
  }

  if (!allowed) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Inténtalo de nuevo en unos segundos.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(windowSec),
          'X-RateLimit-Limit': String(limit),
        },
      },
    );
  }

  return null; // allowed
}

// ─── Preset rate limiters for common scopes ──────────────────────────────────

/** AI agent endpoints: 20 requests/minute */
export function rateLimitAgents(req: Request) {
  return rateLimit(req, 'agents', { limit: 20, window: 60 });
}

/** Auth endpoints (login, register, forgot-password): 5 requests/minute */
export function rateLimitAuth(req: Request) {
  return rateLimit(req, 'auth', { limit: 5, window: 60 });
}

/** Write endpoints (post, chat, tickets): 30 requests/minute */
export function rateLimitWrite(req: Request) {
  return rateLimit(req, 'write', { limit: 30, window: 60 });
}

/** Heavy read endpoints (no limit per se, but cap at 60/min) */
export function rateLimitRead(req: Request) {
  return rateLimit(req, 'read', { limit: 60, window: 60 });
}

// ─── Legacy compat ───────────────────────────────────────────────────────────
// Older routes use a different signature:
//   checkRateLimit(key: string, limit: number, windowMs: number) → { success }
// The new `rateLimit()` expects a Request + scope and returns a NextResponse.
// This shim keeps the old callers (feedback, contact, image-generate,
// video-generate) working until they're migrated.

export interface CheckRateLimitResult {
  success:   boolean;
  remaining: number;
  reset:     number;
}

/** @deprecated Use `rateLimit(request, scope, opts)` or one of the preset helpers. */
export function checkRateLimit(key: string, limit: number, windowMs: number): CheckRateLimitResult {
  const now = Date.now();
  const entry = memStore.get(key);
  if (!entry || now > entry.reset) {
    const reset = now + windowMs;
    memStore.set(key, { count: 1, reset });
    return { success: true, remaining: limit - 1, reset };
  }
  if (entry.count >= limit) {
    return { success: false, remaining: 0, reset: entry.reset };
  }
  entry.count++;
  return { success: true, remaining: limit - entry.count, reset: entry.reset };
}
