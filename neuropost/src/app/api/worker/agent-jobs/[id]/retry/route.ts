// =============================================================================
// POST /api/worker/agent-jobs/:id/retry  — worker-only
// =============================================================================
// Resets a failed or needs_review job back to pending so the next runner tick
// picks it up again. Resets attempts to 0 so max_attempts gives it a fresh
// budget.
//
// Jobs in 'running' or 'done' are refused (409). 'cancelled' jobs can be
// retried — the worker is explicitly overriding the client's cancellation.

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireWorker } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await requireWorker();
    const db = createAdminClient() as DB;

    const { data: job } = await db
      .from('agent_jobs')
      .select('id, status')
      .eq('id', id)
      .maybeSingle();
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    if (job.status === 'running' || job.status === 'done') {
      return NextResponse.json(
        { error: `Cannot retry a job in status '${job.status}'` },
        { status: 409 },
      );
    }

    const { error } = await db
      .from('agent_jobs')
      .update({
        status:      'pending',
        attempts:    0,
        started_at:  null,
        finished_at: null,
        error:       null,
      })
      .eq('id', id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[POST /api/worker/agent-jobs/:id/retry]', err);
    return apiError(err, 'worker/agent-jobs/[id]/retry');
  }
}
