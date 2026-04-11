// =============================================================================
// GET    /api/agent-jobs/:id   — fetch job + its outputs
// DELETE /api/agent-jobs/:id   — cancel a pending job
// =============================================================================
// Both actions require the caller to own the brand that owns the job.
// Running/terminal jobs cannot be cancelled — cancelJob() is a no-op in
// those cases and we surface a 409.

import { NextResponse } from 'next/server';
import { requireServerUser, createAdminClient } from '@/lib/supabase';
import { getJobWithOutputs, cancelJob } from '@/lib/agents/queue';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

async function requireOwnedJob(userId: string, jobId: string) {
  const bundle = await getJobWithOutputs(jobId);
  if (!bundle) return { status: 404 as const, error: 'Job not found' };

  const db = createAdminClient() as DB;
  const { data: brand } = await db
    .from('brands')
    .select('id')
    .eq('id', bundle.job.brand_id)
    .eq('user_id', userId)
    .maybeSingle();
  if (!brand) return { status: 404 as const, error: 'Job not found' };

  return { status: 200 as const, bundle };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await requireServerUser();
    const owned = await requireOwnedJob(user.id, id);
    if (owned.status !== 200) {
      return NextResponse.json({ error: owned.error }, { status: owned.status });
    }
    return NextResponse.json({ job: owned.bundle.job, outputs: owned.bundle.outputs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[GET /api/agent-jobs/:id]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await requireServerUser();
    const owned = await requireOwnedJob(user.id, id);
    if (owned.status !== 200) {
      return NextResponse.json({ error: owned.error }, { status: owned.status });
    }

    const cancelled = await cancelJob(id);
    if (!cancelled) {
      return NextResponse.json(
        { error: 'Job is not cancellable (already running or finished).' },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[DELETE /api/agent-jobs/:id]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
