import { NextResponse }                                   from 'next/server';
import { requireWorker }                                   from '@/lib/worker';
import { createAdminClient }                               from '@/lib/supabase';
import { transitionWeeklyPlanStatus }                      from '@/lib/planning/weekly-plan-service';
import { enqueueClientReviewEmail }                        from '@/lib/planning/trigger-client-email';
import { apiError }                                        from '@/lib/api-utils';
import { log }                                             from '@/lib/logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireWorker();
    const { id } = await params;

    // Clear the worker-review gate on every idea of this plan — approving
    // the plan implicitly approves any pending regenerated variations.
    const db = createAdminClient() as DB;
    await db.from('content_ideas')
      .update({ awaiting_worker_review: false })
      .eq('week_id', id)
      .eq('awaiting_worker_review', true);

    const plan = await transitionWeeklyPlanStatus({ plan_id: id, to: 'client_reviewing', reason: 'worker approved' });

    // P3: handle email result explicitly
    const emailResult = await enqueueClientReviewEmail(id);
    if (!emailResult.ok) {
      log({ level: 'error', scope: 'worker/approve', event: 'client_review_email_failed',
            plan_id: id, error: emailResult.error });
    } else {
      log({ level: 'info', scope: 'worker/approve', event: 'client_review_email_sent', plan_id: id });
    }

    return NextResponse.json({ ok: true, plan });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (msg.includes('Not found') || msg.includes('Plan not found')) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }
    return apiError(err, 'POST /api/worker/weekly-plans/[id]/approve');
  }
}
