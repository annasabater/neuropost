import { NextResponse } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

/**
 * GET /api/worker/jobs/claimed
 * List all jobs claimed by the current worker (manual intervention queue).
 */
export async function GET() {
  try {
    const worker = await requireWorker();
    const db: DB = createAdminClient();

    const { data: jobs, error } = await db
      .from('agent_jobs')
      .select('id, brand_id, agent_type, action, input, status, priority, claimed_at, created_at, brands(name)')
      .eq('status', 'claimed')
      .eq('claimed_by', worker.id)
      .order('claimed_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ jobs: jobs ?? [] });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
