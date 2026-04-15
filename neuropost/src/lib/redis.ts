// =============================================================================
// Redis connection — singleton ioredis client
// =============================================================================
// Shared by BullMQ Queue and Worker instances. A single connection is reused
// across hot-reload cycles in development and across handler invocations in
// the same Vercel function instance.
//
// Required env var:
//   REDIS_URL — full connection string, e.g.:
//     rediss://default:<token>@<host>.upstash.io:6380   (Upstash TLS)
//     redis://localhost:6379                             (local dev)

import IORedis from 'ioredis';

let _redis: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (_redis) return _redis;

  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      'REDIS_URL is not set. Add it to your .env.local and Vercel environment variables.',
    );
  }

  _redis = new IORedis(url, {
    // BullMQ requirement: must be null (disables per-command retry limit)
    maxRetriesPerRequest: null,
    // Don't block startup waiting for READY — BullMQ handles its own checks
    enableReadyCheck: false,
    // Reconnect strategy: exponential backoff capped at 10s
    retryStrategy: (times) => Math.min(times * 200, 10_000),
  });

  _redis.on('error', (err) => {
    console.error('[redis] connection error:', err.message);
  });

  return _redis;
}

/**
 * Returns the same options object that BullMQ Queue/Worker constructors accept
 * when you pass an existing IORedis instance.
 */
export function getBullMQConnection(): IORedis {
  return getRedisConnection();
}
