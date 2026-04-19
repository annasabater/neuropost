import { NextResponse }      from 'next/server';
import { requireWorker }     from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';
import { apiError }          from '@/lib/api-utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function GET() {
  try {
    await requireWorker();
    const db = createAdminClient() as DB;

    const { data, error } = await db
      .from('weekly_plans')
      .select(`
        id, brand_id, week_start, status, created_at,
        brands ( name )
      `)
      .eq('status', 'ideas_ready')
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Attach idea counts
    const plans = data ?? [];
    const withCounts = await Promise.all(
      plans.map(async (plan: { id: string; [key: string]: unknown }) => {
        const { count } = await db
          .from('content_ideas')
          .select('id', { count: 'exact', head: true })
          .eq('week_id', plan.id);
        return { ...plan, ideas_count: count ?? 0 };
      }),
    );

    return NextResponse.json({ plans: withCounts });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return apiError(err, 'GET /api/worker/weekly-plans/pending');
  }
}
