// =============================================================================
// Cron: agent queue runner
// =============================================================================
// Scheduled every minute by vercel.json. Claims a batch of pending jobs from
// agent_jobs and dispatches each to its handler. Safe to invoke manually:
//
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//        https://.../api/cron/agent-queue-runner
//
// The handler registry is empty in F1 — jobs will be marked 'error' with
// "No handler registered for ..." until F2 adds real handlers. That's the
// expected state: infrastructure is live, executors come next.

import { NextResponse } from 'next/server';
import { runOnce } from '@/lib/agents/runner';

// Import the handlers barrel for its side-effects: at module load time it
// calls registerHandler() for every agent (backend package + local agents).
// Adding a new agent = one line in src/lib/agents/handlers/{backend,local}.ts
// plus registering it — no changes needed here.
import '@/lib/agents/handlers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // seconds — runner is capped at 45s internally

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET ?? ''}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runOnce();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[agent-queue-runner]', err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
