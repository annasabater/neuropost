// Simple in-memory rate limiter (for production use @upstash/ratelimit + Redis)
const store = new Map<string, { count: number; reset: number }>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { success: boolean; remaining: number } {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now > entry.reset) {
    store.set(key, { count: 1, reset: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }
  if (entry.count >= limit) return { success: false, remaining: 0 };
  entry.count++;
  return { success: true, remaining: limit - entry.count };
}
