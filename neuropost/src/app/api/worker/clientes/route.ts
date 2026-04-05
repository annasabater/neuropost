import { NextResponse } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    const worker = await requireWorker();
    const db     = createAdminClient();

    let query = db.from('brands').select(`
      id, name, sector, plan, ig_username, ig_account_id, fb_page_id,
      meta_token_expires_at, publish_mode, created_at, trial_ends_at,
      posts_this_week, stories_this_week
    `).order('name');

    if (worker.role === 'worker' && worker.brands_assigned?.length) {
      query = query.in('id', worker.brands_assigned);
    }

    const { data: brands, error } = await query;
    if (error) throw error;

    // Enrich with queue counts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const brandIds = (brands ?? []).map((b: any) => b.id);
    const { data: queueCounts } = await db
      .from('content_queue')
      .select('brand_id, status')
      .in('brand_id', brandIds)
      .eq('status', 'pending_worker');

    const pendingByBrand: Record<string, number> = {};
    for (const q of queueCounts ?? []) {
      pendingByBrand[q.brand_id] = (pendingByBrand[q.brand_id] ?? 0) + 1;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enriched = (brands ?? []).map((b: any) => ({
      ...b,
      pending_in_queue: pendingByBrand[b.id] ?? 0,
    }));

    return NextResponse.json({ clients: enriched });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
