// =============================================================================
// POST /api/worker/trigger-queue  — manually fire the agent queue runner
// =============================================================================
// Worker-only endpoint for local development (Vercel cron doesn't run on localhost).
// Calls runOnce() directly so a worker can drain the queue on demand.

import { NextResponse } from 'next/server';
import { requireWorker } from '@/lib/worker';
import { runOnce } from '@/lib/agents/runner';
import '@/lib/agents/handlers';

export async function POST() {
  try {
    await requireWorker();
    const result = await runOnce();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('[POST /api/worker/trigger-queue]', err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
