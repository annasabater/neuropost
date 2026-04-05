import { NextResponse } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const worker = await requireWorker();
    const db     = createAdminClient();
    const { searchParams } = new URL(request.url);
    const mine   = searchParams.get('mine') === '1';

    let query = db
      .from('client_activity_log')
      .select('*, brands(name, sector)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (mine && worker.role === 'worker' && worker.brands_assigned?.length) {
      query = query.in('brand_id', worker.brands_assigned);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ events: data ?? [] });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
