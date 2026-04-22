// =============================================================================
// Cron: drain-agent-jobs  —  Supabase-only fallback runner
// GET /api/cron/drain-agent-jobs
// =============================================================================
// Runs every 5 minutes. Picks up jobs that are sitting in agent_jobs with
// status='pending' and were created more than 2 minutes ago, meaning BullMQ
// never dequeued them (Redis down, rate-limited, or enqueue failure).
//
// This cron bypasses Redis/BullMQ entirely and calls the handler registry
// directly, the same code path the runner uses in Supabase-fallback mode.
// It is safe to run concurrently with agent-queue-runner: both use an atomic
// CAS update (status: 'pending' → 'running') so only one runner claims a job.
//
// Typical cause: Upstash free-tier hitting 500k/month → ERR max requests.
// Fix: Upstash now triggers the Supabase fallback in the main runner too
// (runner.ts:287), but this dedicated cron gives an explicit safety net that
// fires even if the main runner also fails to initialise BullMQ.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { lookupHandler } from '@/lib/agents/registry';
import type { AgentJob } from '@/lib/agents/types';

// Side-effect: register all handlers so lookupHandler() works.
import '@/lib/agents/handlers';

export const dynamic     = 'force-dynamic';
export const maxDuration = 270; // seconds — fits within Vercel's 300s limit

// Jobs older than this threshold are candidates for draining.
const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 min
// Max jobs per cron tick — keeps wall-clock time under maxDuration.
const BATCH_SIZE = 5;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function GET(request: Request) {
  const auth      = request.headers.get('authorization');
  const isVercel  = request.headers.get('x-vercel-cron') === '1';
  const secret    = process.env.CRON_SECRET ?? '';
  const validBearer = secret && auth === `Bearer ${secret}`;

  if (!isVercel && !validBearer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const t0 = Date.now();
  const db: DB = createAdminClient();

  // ── 1. Orphan recovery: reset jobs stuck in 'running' > 10 min ─────────────
  const orphanThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  let recovered: Array<{ id: string }> | null = null;
  try {
    const { data } = await db
      .from('agent_jobs')
      .update({ status: 'pending', error: 'drain-cron: orphan recovery' })
      .eq('status', 'running')
      .lt('started_at', orphanThreshold)
      .lt('attempts', 3)
      .select('id');
    recovered = data ?? null;
  } catch (e) {
    console.error('[drain-agent-jobs] orphan recovery failed:', e);
  }

  if (recovered?.length) {
    console.log(`[drain-agent-jobs] Recovered ${recovered.length} orphan job(s)`);
  }

  // ── 2. Claim stale pending jobs ─────────────────────────────────────────────
  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();

  const { data: candidates } = await db
    .from('agent_jobs')
    .select('*')
    .eq('status', 'pending')
    .lt('created_at', staleThreshold)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (!candidates?.length) {
    return NextResponse.json({ ok: true, drained: 0, recovered: recovered?.length ?? 0, elapsedMs: Date.now() - t0 });
  }

  let drained = 0;
  let errored = 0;

  for (const row of candidates as AgentJob[]) {
    // Atomic claim — CAS: only proceeds if still 'pending'
    const { data: claimed } = await db
      .from('agent_jobs')
      .update({
        status:     'running',
        started_at: new Date().toISOString(),
        attempts:   (row.attempts ?? 0) + 1,
      })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (!claimed) continue; // already claimed by another runner

    const job: AgentJob = {
      ...row,
      status:     'running',
      attempts:   (row.attempts ?? 0) + 1,
      started_at: new Date().toISOString(),
    };

    const handler = lookupHandler(job.agent_type, job.action);
    if (!handler) {
      await db.from('agent_jobs').update({ status: 'error', error: `No handler: ${job.agent_type}:${job.action}` }).eq('id', job.id);
      errored++;
      continue;
    }

    try {
      const result = await Promise.race([
        handler(job),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('drain-cron: handler timeout 240s')), 240_000),
        ),
      ]);

      if (result.type === 'ok') {
        if (result.outputs?.length) {
          const rows = result.outputs.map((o) => ({
            job_id:      job.id,
            brand_id:    job.brand_id,
            kind:        o.kind,
            payload:     o.payload,
            preview_url: o.preview_url ?? null,
            cost_usd:    o.cost_usd    ?? null,
            tokens_used: o.tokens_used ?? null,
            model:       o.model       ?? null,
          }));
          try {
            await db.from('agent_outputs').insert(rows);
          } catch (e) {
            console.error('[drain-agent-jobs] saveOutputs error:', e);
          }
        }
        await db.from('agent_jobs').update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', job.id);
        drained++;
      } else if (result.type === 'retry' && job.attempts < (job.max_attempts ?? 3)) {
        await db.from('agent_jobs').update({ status: 'pending', error: result.error }).eq('id', job.id);
      } else {
        const errMsg = result.type === 'fail' ? result.error : (result.type === 'retry' ? `Max retries: ${result.error}` : 'Unknown');
        await db.from('agent_jobs').update({ status: 'error', error: errMsg, completed_at: new Date().toISOString() }).eq('id', job.id);
        errored++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const canRetry = (job.attempts ?? 0) < (job.max_attempts ?? 3);
      await db.from('agent_jobs')
        .update(canRetry
          ? { status: 'pending', error: msg }
          : { status: 'error', error: msg, completed_at: new Date().toISOString() })
        .eq('id', job.id);
      console.error(`[drain-agent-jobs] Job ${job.id} (${job.agent_type}:${job.action}) failed:`, msg);
      errored++;
    }
  }

  console.log(`[drain-agent-jobs] drained=${drained} errored=${errored} recovered=${recovered?.length ?? 0} elapsed=${Date.now() - t0}ms`);

  return NextResponse.json({
    ok:        true,
    drained,
    errored,
    recovered: recovered?.length ?? 0,
    elapsedMs: Date.now() - t0,
  });
}
