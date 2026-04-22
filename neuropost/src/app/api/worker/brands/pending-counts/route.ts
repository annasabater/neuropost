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

    // unread_messages is zeroed until the worker→client mark-read endpoint exists.
    // Badge currently reflects only pending ideas + pending plans.
    // TODO: reactivate when POST /api/worker/brands/[brandId]/chat/mark-read is implemented.
    const [changesRes, plansRes] = await Promise.all([
      db
        .from('content_ideas')
        .select('brand_id')
        .in('brand_id', brandIds)
        .eq('awaiting_worker_review', true)
        .eq('status', 'pending'),
      db
        .from('weekly_plans')
        .select('brand_id')
        .in('brand_id', brandIds)
        .in('status', ['ideas_ready', 'client_approved']),
    ]);

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
    for (const id of brandIds) {
      const c = counts[id];
      c.total = c.changes_requested + c.weekly_plans_pending; // unread_messages excluded (always 0)
    }

    return NextResponse.json({ counts });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
