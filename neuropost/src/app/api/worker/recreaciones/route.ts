import { NextResponse } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    const worker = await requireWorker();
    const db = createAdminClient();

    let query = db
      .from('recreation_requests')
      .select(`
        *,
        inspiration_references ( title, thumbnail_url, source_url, notes ),
        brands ( name )
      `)
      .order('created_at', { ascending: false });

    // Non-admin/senior workers only see their assigned brands
    if (worker.role === 'worker' && worker.brands_assigned?.length) {
      query = query.in('brand_id', worker.brands_assigned);
    }

    const { data: recreations, error } = await query;
    if (error) throw error;
    return NextResponse.json({ recreations: recreations ?? [] });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
