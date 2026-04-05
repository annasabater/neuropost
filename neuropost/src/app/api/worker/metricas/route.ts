import { NextResponse } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const worker = await requireWorker();
    const db     = createAdminClient();
    const { searchParams } = new URL(request.url);
    const mine   = searchParams.get('mine') === '1';

    const now    = new Date();
    const start  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    let query = db
      .from('content_queue')
      .select('status, assigned_worker_id, worker_reviewed_at, created_at, priority')
      .gte('created_at', start);

    if (mine) query = query.eq('assigned_worker_id', worker.id);

    const { data: items, error } = await query;
    if (error) throw error;

    const all = items ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const validated    = all.filter((i: any) => ['worker_approved','worker_rejected','sent_to_client','client_approved','client_rejected'].includes(i.status));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const approved     = all.filter((i: any) => i.status === 'client_approved');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalSent    = all.filter((i: any) => ['sent_to_client','client_approved','client_rejected'].includes(i.status));
    const approvalRate = totalSent.length ? Math.round((approved.length / totalSent.length) * 100) : 0;

    const times = validated
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((i: any) => i.worker_reviewed_at)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((i: any) => (new Date(i.worker_reviewed_at).getTime() - new Date(i.created_at).getTime()) / 3600000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const avgTime = times.length ? (times.reduce((s: number, t: number) => s + t, 0) / times.length).toFixed(1) : '0';

    return NextResponse.json({
      totalValidated:    validated.length,
      approvalRate,
      avgResponseTimeH:  avgTime,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rejected:          all.filter((i: any) => i.status === 'client_rejected').length,
    });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
