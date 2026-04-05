import { NextResponse } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const worker = await requireWorker();
    const db     = createAdminClient();
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');

    let query = db
      .from('worker_messages')
      .select('*, workers!from_worker_id(full_name, avatar_url)')
      .or(`to_worker_id.eq.${worker.id},to_worker_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(100);

    if (brandId) query = query.eq('brand_id', brandId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ messages: data ?? [] });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const worker = await requireWorker();
    const body   = await request.json() as { brand_id?: string; to_worker_id?: string; message: string };
    const db     = createAdminClient();

    const { data, error } = await db
      .from('worker_messages')
      .insert({
        from_worker_id: worker.id,
        to_worker_id:   body.to_worker_id ?? null,
        brand_id:       body.brand_id ?? null,
        message:        body.message,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ message: data }, { status: 201 });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
