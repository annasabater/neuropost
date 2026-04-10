import { NextResponse } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const worker = await requireWorker();
    const db = createAdminClient();
    const url = new URL(request.url);
    const brandId = url.searchParams.get('brandId');
    const unread = url.searchParams.get('unread');

    let query = db
      .from('chat_messages')
      .select('*, brands(id, name)')
      .eq('sender_type', 'client')
      .order('created_at', { ascending: false })
      .limit(100);

    if (unread === 'true') query = query.is('read_by_worker', false);
    if (brandId) query = query.eq('brand_id', brandId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ messages: data ?? [], currentWorkerId: worker.id });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const _worker = await requireWorker();
    const db = createAdminClient();
    const url = new URL(request.url);
    const brandId = url.searchParams.get('brandId');

    if (!brandId) return NextResponse.json({ error: 'brandId required' }, { status: 400 });

    const { data, error } = await db
      .from('chat_messages')
      .update({ read: true })
      .eq('brand_id', brandId)
      .eq('sender_type', 'client');

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}

