// =============================================================================
// GET /api/worker/system-health — system health dashboard for workers
// =============================================================================
// Returns the last 24h of health metrics + current queue depth + active incidents.

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireWorker } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function GET() {
  try {
    await requireWorker();
    const db = createAdminClient() as DB;

    // Last 24h of health checks (every 5 min = ~288 data points)
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();

    const { data: metrics } = await db
      .from('health_metrics')
      .select('checked_at, supabase_ms, redis_ms, anthropic_ms, replicate_ms, stripe_ms, meta_api_ms, queue_pending, queue_running, queue_errored, all_healthy')
      .gte('checked_at', since)
      .order('checked_at', { ascending: true })
      .limit(300);

    // Active incidents
    const { data: incidents } = await db
      .from('service_incidents')
      .select('id, title, severity, affected_services, status, created_at')
      .in('status', ['investigating', 'identified', 'monitoring'])
      .order('created_at', { ascending: false })
      .limit(10);

    // Current queue stats
    const { count: pending } = await db
      .from('agent_jobs').select('id', { count: 'exact', head: true }).eq('status', 'pending');
    const { count: running } = await db
      .from('agent_jobs').select('id', { count: 'exact', head: true }).eq('status', 'running');
    const { count: errored } = await db
      .from('agent_jobs').select('id', { count: 'exact', head: true }).eq('status', 'error')
      .gte('finished_at', new Date(Date.now() - 3600_000).toISOString());
    const { count: doneToday } = await db
      .from('agent_jobs').select('id', { count: 'exact', head: true }).eq('status', 'done')
      .gte('finished_at', new Date(Date.now() - 24 * 3600_000).toISOString());

    // Latest health check
    const latest = (metrics ?? []).length > 0 ? (metrics as Record<string, unknown>[])[metrics.length - 1] : null;

    // Compute uptime % (last 24h)
    const total  = (metrics ?? []).length;
    const healthy = (metrics ?? []).filter((m: Record<string, boolean>) => m.all_healthy).length;
    const uptimePct = total > 0 ? Math.round((healthy / total) * 10000) / 100 : 100;

    return NextResponse.json({
      uptime_24h_pct: uptimePct,
      latest_check:   latest,
      queue: {
        pending:    pending ?? 0,
        running:    running ?? 0,
        errored_1h: errored ?? 0,
        done_24h:   doneToday ?? 0,
      },
      incidents:  incidents ?? [],
      timeline:   metrics ?? [],
    });
  } catch (err) {
    return apiError(err, 'GET /api/worker/system-health');
  }
}
