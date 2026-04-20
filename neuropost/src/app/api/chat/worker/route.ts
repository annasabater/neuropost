import { NextResponse } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const worker = await requireWorker();
    const db = createAdminClient();
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');

    let query = db.from('chat_messages').select('*, brands(name)').order('created_at', { ascending: true });
    if (brandId) {
      query = query.eq('brand_id', brandId);
    } else if (worker.role === 'worker' && worker.brands_assigned?.length) {
      query = query.in('brand_id', worker.brands_assigned);
    }

    const { data: messages, error } = await query;
    if (error) throw error;

    return NextResponse.json({ messages: messages ?? [] });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const worker = await requireWorker();
    const db = createAdminClient();
    const body = await request.json();
    const { brand_id, message, attachments = [] } = body;

    if (!brand_id) return NextResponse.json({ error: 'brand_id required' }, { status: 400 });
    if (!message?.trim() && attachments.length === 0) return NextResponse.json({ error: 'Message required' }, { status: 400 });

    const { data: msg, error } = await db.from('chat_messages').insert({
      brand_id,
      sender_id: (worker as unknown as Record<string, unknown>).user_id as string | undefined,
      sender_type: 'worker',
      message: message?.trim() ?? '',
      attachments,
    }).select().single();
    if (error) throw error;

    // Notify client that worker sent a message
    try {
      await db.from('notifications').insert({
        brand_id,
        type: 'chat_message',
        message: 'Nuevo mensaje del equipo de NeuroPost.',
        read: false,
        metadata: { messageId: msg.id },
      });
    } catch (notifErr) {
      console.error('[chat/worker] Failed to insert notification:', notifErr);
    }

    return NextResponse.json({ message: msg });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
