import { NextResponse } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export type PendingCount = {
  changes_requested:   number;
  weekly_plans_pending: number;
  unread_messages:     number;
  total:               number;
};

export async function GET() {
  try {
    const worker = await requireWorker();
    const db = createAdminClient() as DB;

    let brandsQ = db.from('brands').select('id');
    if (worker.role === 'worker' && worker.brands_assigned?.length) {
      brandsQ = brandsQ.in('id', worker.brands_assigned);
    }
    const { data: brandsData, error: brandsErr } = await brandsQ;
    if (brandsErr) throw brandsErr;

    const brandIds: string[] = (brandsData ?? []).map((b: { id: string }) => b.id);
    if (brandIds.length === 0) return NextResponse.json({ counts: {} });

    const [changesRes, plansRes] = await Promise.all([
      db
        .from('content_ideas')
        .select('brand_id')
        .in('brand_id', brandIds)
        .eq('awaiting_worker_review', true),
      db
        .from('weekly_plans')
        .select('brand_id')
        .in('brand_id', brandIds)
        .in('status', ['ideas_ready', 'client_approved']),
    ]);

    let unreadData: { brand_id: string }[] = [];
    try {
      const { data } = await db
        .from('chat_messages')
        .select('brand_id')
        .in('brand_id', brandIds)
        .eq('sender_type', 'client')
        .is('read_at', null);
      unreadData = data ?? [];
    } catch { /* non-blocking: if chat_messages is unavailable, unread = 0 */ }

    const counts: Record<string, PendingCount> = {};
    for (const id of brandIds) {
      counts[id] = { changes_requested: 0, weekly_plans_pending: 0, unread_messages: 0, total: 0 };
    }
    for (const row of changesRes.data ?? []) {
      if (counts[row.brand_id]) counts[row.brand_id].changes_requested++;
    }
    for (const row of plansRes.data ?? []) {
      if (counts[row.brand_id]) counts[row.brand_id].weekly_plans_pending++;
    }
    for (const row of unreadData) {
      if (counts[row.brand_id]) counts[row.brand_id].unread_messages++;
    }
    for (const id of brandIds) {
      const c = counts[id];
      c.total = c.changes_requested + c.weekly_plans_pending + c.unread_messages;
    }

    return NextResponse.json({ counts });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
