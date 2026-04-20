import { NextResponse } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    const worker = await requireWorker();
    const db     = createAdminClient();

    // Ordena por antigüedad (los clientes más antiguos primero)
    let query = db.from('brands').select(`
      id, user_id, name, sector, plan, ig_username, ig_account_id, fb_page_id,
      meta_token_expires_at, publish_mode, created_at, trial_ends_at,
      posts_this_week, stories_this_week
    `).order('created_at', { ascending: true });

    if (worker.role === 'worker' && worker.brands_assigned?.length) {
      query = query.in('id', worker.brands_assigned);
    }

    const { data: brands, error } = await query;
    if (error) throw error;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const brandIds: string[] = (brands ?? []).map((b: any) => b.id);

    // Queue counts
    const { data: queueCounts } = await db
      .from('content_queue')
      .select('brand_id, status')
      .in('brand_id', brandIds)
      .eq('status', 'pending_worker');

    const pendingByBrand: Record<string, number> = {};
    for (const q of queueCounts ?? []) {
      pendingByBrand[q.brand_id] = (pendingByBrand[q.brand_id] ?? 0) + 1;
    }

    // Emails desde auth.users (a través de user_id de cada brand)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emailByBrand: any = {};
    try {
      const { data: authList } = await db.auth.admin.listUsers();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const emailMap = new Map((authList?.users ?? []).map((u: any) => [u.id, u.email ?? '']));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const b of brands as any) {
        if (b.user_id) emailByBrand[b.id] = emailMap.get(b.user_id) ?? '';
      }
    } catch {
      // Si falla el listUsers seguimos sin emails
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enriched = (brands ?? []).map((b: any) => ({
      ...b,
      email: emailByBrand[b.id] ?? null,
      pending_in_queue: pendingByBrand[b.id] ?? 0,
    }));

    return NextResponse.json({ clients: enriched });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
