import { NextResponse }              from 'next/server';
import { requireServerUser }         from '@/lib/supabase';
import { createAdminClient }         from '@/lib/supabase';
import { transitionWeeklyPlanStatus } from '@/lib/planning/weekly-plan-service';
import { apiError }                  from '@/lib/api-utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireServerUser();
    const { id } = await params;
    const db = createAdminClient() as DB;

    const { data: plan } = await db
      .from('weekly_plans')
      .select('id, status, brands!inner ( user_id )')
      .eq('id', id)
      .single();

    if (!plan) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (plan.brands?.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json() as { reason?: string };
    if (!body.reason?.trim()) {
      return NextResponse.json({ error: 'reason es obligatorio' }, { status: 400 });
    }

    await db.from('weekly_plans').update({ skip_reason: body.reason }).eq('id', id);
    const updated = await transitionWeeklyPlanStatus({ plan_id: id, to: 'skipped_by_client', reason: body.reason });

    return NextResponse.json({ ok: true, plan: updated });
  } catch (err) {
    return apiError(err, 'POST /api/client/weekly-plans/[id]/skip-week');
  }
}
