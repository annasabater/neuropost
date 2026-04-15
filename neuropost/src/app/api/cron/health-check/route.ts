// =============================================================================
// Cron: health-check — per-service probes with metrics persistence
// =============================================================================
// Runs every 5 minutes. Probes each dependency, records response times,
// auto-creates incidents if critical services fail.

import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export const dynamic    = 'force-dynamic';
export const maxDuration = 30;

interface ProbeResult {
  healthy: boolean;
  ms:      number | null;
  error?:  string;
}

async function probe(name: string, fn: () => Promise<void>): Promise<ProbeResult> {
  const t0 = Date.now();
  try {
    await fn();
    return { healthy: true, ms: Date.now() - t0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { healthy: false, ms: Date.now() - t0, error: msg };
  }
}

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET ?? ''}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = createAdminClient() as DB;
  const results: Record<string, ProbeResult> = {};

  // ─── 1. Supabase (DB) ──────────────────────────────────────────────────────
  results.supabase = await probe('supabase', async () => {
    const { error } = await db.from('brands').select('id').limit(1);
    if (error) throw new Error(error.message);
  });

  // ─── 2. Redis (BullMQ) ────────────────────────────────────────────────────
  results.redis = await probe('redis', async () => {
    if (!process.env.REDIS_URL) throw new Error('REDIS_URL not configured');
    const { getRedisConnection } = await import('@/lib/redis');
    const redis = getRedisConnection();
    const pong = await redis.ping();
    if (pong !== 'PONG') throw new Error(`Expected PONG, got ${pong}`);
  });

  // ─── 3. Anthropic API ─────────────────────────────────────────────────────
  results.anthropic = await probe('anthropic', async () => {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });
    if (!res.ok && res.status !== 400) throw new Error(`HTTP ${res.status}`);
    // 400 = valid auth but bad request (fine for a health check)
  });

  // ─── 4. Replicate ─────────────────────────────────────────────────────────
  results.replicate = await probe('replicate', async () => {
    if (!process.env.REPLICATE_API_TOKEN) throw new Error('REPLICATE_API_TOKEN not configured');
    const res = await fetch('https://api.replicate.com/v1/account', {
      headers: { 'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });

  // ─── 5. Stripe ────────────────────────────────────────────────────────────
  results.stripe = await probe('stripe', async () => {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured');
    const res = await fetch('https://api.stripe.com/v1/balance', {
      headers: { 'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });

  // ─── 6. Meta API ──────────────────────────────────────────────────────────
  results.meta_api = await probe('meta_api', async () => {
    // Just check the Graph API is reachable (no auth needed for this endpoint)
    const res = await fetch('https://graph.facebook.com/v21.0/me?access_token=invalid_token');
    // We expect 400/190 (invalid token) — that means the API is up
    if (res.status >= 500) throw new Error(`Meta API HTTP ${res.status}`);
  });

  // ─── 7. Agent queue depth ─────────────────────────────────────────────────
  let queuePending = 0;
  let queueRunning = 0;
  let queueErrored = 0;
  try {
    const { count: pending } = await db
      .from('agent_jobs').select('id', { count: 'exact', head: true }).eq('status', 'pending');
    const { count: running } = await db
      .from('agent_jobs').select('id', { count: 'exact', head: true }).eq('status', 'running');
    const { count: errored } = await db
      .from('agent_jobs').select('id', { count: 'exact', head: true }).eq('status', 'error')
      .gte('finished_at', new Date(Date.now() - 3600_000).toISOString());
    queuePending = pending ?? 0;
    queueRunning = running ?? 0;
    queueErrored = errored ?? 0;
  } catch { /* non-critical */ }

  // ─── Persist metrics ──────────────────────────────────────────────────────
  const allHealthy = Object.values(results).every(r => r.healthy);

  try {
    await db.from('health_metrics').insert({
      supabase_ms:   results.supabase?.ms   ?? null,
      redis_ms:      results.redis?.ms      ?? null,
      anthropic_ms:  results.anthropic?.ms  ?? null,
      replicate_ms:  results.replicate?.ms  ?? null,
      stripe_ms:     results.stripe?.ms     ?? null,
      meta_api_ms:   results.meta_api?.ms   ?? null,
      queue_pending: queuePending,
      queue_running: queueRunning,
      queue_errored: queueErrored,
      all_healthy:   allHealthy,
      details:       results,
    });

    // Auto-cleanup: delete metrics older than 30 days
    const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
    await db.from('health_metrics').delete().lt('checked_at', cutoff);
  } catch { /* metrics persistence is non-critical */ }

  // ─── Auto-incident on critical failure ────────────────────────────────────
  if (!results.supabase.healthy || !results.redis.healthy) {
    const failures = Object.entries(results).filter(([, r]) => !r.healthy).map(([k]) => k);

    try {
      const { data: existing } = await db
        .from('service_incidents')
        .select('id')
        .eq('status', 'investigating')
        .limit(1)
        .maybeSingle();

      if (!existing) {
        await db.from('service_incidents').insert({
          title:             `Fallo detectado: ${failures.join(', ')}`,
          severity:          !results.supabase.healthy ? 'critical' : 'major',
          affected_services: failures,
          status:            'investigating',
        });
      }

      Sentry.captureMessage(`Health check failure: ${failures.join(', ')}`, {
        level: 'error',
        tags: { component: 'health-check' },
        extra: results,
      });
    } catch { /* non-critical */ }
  }

  return NextResponse.json({
    ok:           allHealthy,
    checked_at:   new Date().toISOString(),
    services:     results,
    queue: { pending: queuePending, running: queueRunning, errored_1h: queueErrored },
  });
}
