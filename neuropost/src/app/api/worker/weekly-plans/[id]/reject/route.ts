import { NextResponse }              from 'next/server';
import { requireWorker }             from '@/lib/worker';
import { createAdminClient }         from '@/lib/supabase';
import { transitionWeeklyPlanStatus } from '@/lib/planning/weekly-plan-service';
import { apiError }                  from '@/lib/api-utils';

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

    const plan = await transitionWeeklyPlanStatus({ plan_id: id, to: 'expired', reason: 'worker rejected' });

    return NextResponse.json({ ok: true, plan });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return apiError(err, 'POST /api/worker/weekly-plans/[id]/reject');
  }
}
