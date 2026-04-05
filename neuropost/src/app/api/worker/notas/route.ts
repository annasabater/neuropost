import { NextResponse } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const worker = await requireWorker();
    const body   = await request.json() as { brand_id: string; note: string; is_pinned?: boolean };
    const db     = createAdminClient();

    const { data, error } = await db
      .from('client_notes')
      .insert({ brand_id: body.brand_id, worker_id: worker.id, note: body.note, is_pinned: body.is_pinned ?? false })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ note: data }, { status: 201 });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireWorker();
    const body = await request.json() as { id: string; is_pinned?: boolean; note?: string };
    const db   = createAdminClient();

    const updates: Record<string, unknown> = {};
    if (body.is_pinned !== undefined) updates.is_pinned = body.is_pinned;
    if (body.note !== undefined) updates.note = body.note;

    const { data, error } = await db
      .from('client_notes').update(updates).eq('id', body.id).select().single();
    if (error) throw error;
    return NextResponse.json({ note: data });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
