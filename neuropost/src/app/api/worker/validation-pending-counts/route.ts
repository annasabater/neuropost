import { NextResponse }                    from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient }               from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function GET() {
  try {
    await requireWorker();
    const db = createAdminClient() as DB;

    const [proposalsRes, plansRes, retouchesRes] = await Promise.all([
      db
        .from('proposals')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending_qc', 'qc_rejected_image', 'qc_rejected_caption', 'failed']),
      db
        .from('weekly_plans')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'ideas_ready'),
      db
        .from('retouch_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
    ]);

    const proposals    = proposalsRes.count  ?? 0;
    const weekly_plans = plansRes.count      ?? 0;
    const retouches    = retouchesRes.count  ?? 0;

    return NextResponse.json({
      proposals,
      weekly_plans,
      retouches,
      total: proposals + weekly_plans + retouches,
    });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
