import { NextResponse }                        from 'next/server';
import { requireWorker }                       from '@/lib/worker';
import { createAdminClient }                   from '@/lib/supabase';
import { transitionWeeklyPlanStatus }          from '@/lib/planning/weekly-plan-service';
import { enqueueClientPlanRejectedEmail }      from '@/lib/planning/trigger-client-email';
import { apiError }                            from '@/lib/api-utils';
import { log }                                 from '@/lib/logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireWorker();
    const { id } = await params;

    const body = await req.json() as { skip_reason?: string };
    if (!body.skip_reason?.trim()) {
      return NextResponse.json({ error: 'skip_reason es obligatorio' }, { status: 400 });
    }

    const db = createAdminClient() as DB;
    await db.from('weekly_plans').update({ skip_reason: body.skip_reason }).eq('id', id);

    // Clear the worker-review gate on every idea of this plan — rejecting
    // the plan means nothing reaches the client; the gate is moot.
    await db.from('content_ideas')
      .update({ awaiting_worker_review: false })
      .eq('week_id', id)
      .eq('awaiting_worker_review', true);

    const plan = await transitionWeeklyPlanStatus({ plan_id: id, to: 'expired', reason: 'worker rejected' });

    // P4: notify client that no plan was generated this week
    const emailResult = await enqueueClientPlanRejectedEmail(id, body.skip_reason);
    if (!emailResult.ok) {
      log({ level: 'error', scope: 'worker/reject', event: 'rejection_email_failed',
            plan_id: id, error: emailResult.error });
    } else {
      log({ level: 'info', scope: 'worker/reject', event: 'rejection_email_sent', plan_id: id });
    }

    return NextResponse.json({ ok: true, plan });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return apiError(err, 'POST /api/worker/weekly-plans/[id]/reject');
  }
}
