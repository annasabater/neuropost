import { NextResponse }                                   from 'next/server';
import { requireWorker }                                   from '@/lib/worker';
import { createAdminClient }                               from '@/lib/supabase';
import { transitionWeeklyPlanStatus }                      from '@/lib/planning/weekly-plan-service';
import { enqueueClientReviewEmail }                        from '@/lib/planning/trigger-client-email';
import { apiError }                                        from '@/lib/api-utils';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireWorker();
    const { id } = await params;

    const plan = await transitionWeeklyPlanStatus({ plan_id: id, to: 'client_reviewing', reason: 'worker approved' });
    await enqueueClientReviewEmail(id);

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
