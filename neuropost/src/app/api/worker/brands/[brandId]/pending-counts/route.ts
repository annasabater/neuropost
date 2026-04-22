import { NextResponse } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';
import type { PendingCount } from '../../pending-counts/route';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    await requireWorker();
    const { brandId } = await params;
    const db = createAdminClient() as DB;

    const [changesRes, plansRes] = await Promise.all([
      db
        .from('content_ideas')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .eq('awaiting_worker_review', true),
      db
        .from('weekly_plans')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .in('status', ['ideas_ready', 'client_approved']),
    ]);

    let unread_messages = 0;
    try {
      const { count } = await db
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .eq('sender_type', 'client')
        .is('read_at', null);
      unread_messages = count ?? 0;
    } catch { /* non-blocking */ }

    const changes_requested   = changesRes.count   ?? 0;
    const weekly_plans_pending = plansRes.count ?? 0;

    const result: PendingCount = {
      changes_requested,
      weekly_plans_pending,
      unread_messages,
      total: changes_requested + weekly_plans_pending + unread_messages,
    };

    return NextResponse.json(result);
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
