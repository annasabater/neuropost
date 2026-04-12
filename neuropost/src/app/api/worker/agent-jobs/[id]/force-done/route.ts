// =============================================================================
// POST /api/worker/agent-jobs/:id/force-done  — worker-only
// =============================================================================
// Force-closes a stuck or unfixable job as 'done'. Use cases:
//   • Worker resolved the issue manually (e.g. uploaded asset by hand)
//   • Job stuck in 'needs_review' indefinitely
//   • Debugging — clear state without dropping the audit trail
//
// Does NOT write a result — the caller can optionally pass a note that lands
// in the `error` column (renamed "resolution" semantically for force-done).

import { NextResponse } from 'next/server';
import { requireWorker } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

interface Body {
  note?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await requireWorker();
    const body = (await request.json().catch(() => ({}))) as Body;

    const db = createAdminClient() as DB;

    const { data: job } = await db
      .from('agent_jobs')
      .select('id, status')
      .eq('id', id)
      .maybeSingle();
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    if (job.status === 'done') {
      return NextResponse.json({ ok: true, note: 'already done' });
    }

    const { error } = await db
      .from('agent_jobs')
      .update({
        status:      'done',
        finished_at: new Date().toISOString(),
        error:       body.note ? `[force-done] ${body.note}` : null,
      })
      .eq('id', id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[POST /api/worker/agent-jobs/:id/force-done]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
