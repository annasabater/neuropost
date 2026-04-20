import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';
import { logWorkerAction } from '@/lib/audit';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

/**
 * POST /api/worker/jobs/:id/claim
 * Claim a pending job for manual intervention. The runner will skip it.
 * Only admin/owner roles can claim jobs.
 */
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const worker = await requireWorker();
    const { id: jobId } = await ctx.params;
    const db: DB = createAdminClient();

    // Atomically claim only if still pending
    const { data: updated, error } = await db
      .from('agent_jobs')
      .update({
        status:     'claimed',
        claimed_by: worker.id,
        claimed_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .eq('status', 'pending')
      .select()
      .maybeSingle();

    if (error) throw error;

    if (!updated) {
      return NextResponse.json(
        { error: 'Job no disponible para reclamar (ya no está pending)' },
        { status: 409 },
      );
    }

    // Audit log
    void logWorkerAction(worker.id, worker.full_name ?? 'Worker', 'claim', 'agent_job',
      `${worker.full_name ?? 'Worker'} reclamó Job ${jobId.slice(0, 8)} (${updated.agent_type}:${updated.action})`,
      { resource_id: jobId, brand_id: updated.brand_id ?? undefined });

    // Log the claim as a notification
    const brandId = updated.brand_id;
    if (brandId) {
      await db.from('worker_notifications').insert({
        type: 'job_claimed',
        message: `${worker.full_name ?? 'Worker'} reclamó tarea ${updated.agent_type}:${updated.action}`,
        brand_id: brandId,
        brand_name: null,
        read: false,
        metadata: { job_id: jobId, worker_id: worker.id },
      }).then(() => null);
    }

    return NextResponse.json({ job: updated });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
