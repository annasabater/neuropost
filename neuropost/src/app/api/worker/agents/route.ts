import { NextResponse } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    await requireWorker();
    const db = createAdminClient();

    const { data, error } = await db
      .from('workers')
      .select('id, full_name')
      .eq('is_active', true)
      .order('full_name', { ascending: true });

    if (error) throw error;

    const agents = (data ?? []).map((worker: { id: string; full_name: string }) => ({
      id: worker.id,
      name: worker.full_name,
    }));

    return NextResponse.json({ agents });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
