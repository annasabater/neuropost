import { NextResponse } from 'next/server';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const user = await requireServerUser();
    const db = createAdminClient();
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');

    const { data: brand } = await db.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    const resolvedBrandId = brandId ?? brand.id;

    const { data: messages, error } = await db
      .from('chat_messages')
      .select('*')
      .eq('brand_id', resolvedBrandId)
      .order('created_at', { ascending: true });
    if (error) throw error;

    return NextResponse.json({ messages: messages ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('[GET /api/chat]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireServerUser();
    const db = createAdminClient();
    const body = await request.json();
    const { message, attachments = [], brandId: bodyBrandId } = body;

    if (!message?.trim() && (!attachments || attachments.length === 0)) {
      return NextResponse.json({ error: 'Message or attachment required' }, { status: 400 });
    }

    const { data: brand } = await db.from('brands').select('id, name').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    const brandId = bodyBrandId ?? brand.id;

    const { data: msg, error } = await db.from('chat_messages').insert({
      brand_id: brandId,
      sender_id: user.id,
      sender_type: 'client',
      message: message?.trim() ?? '',
      attachments,
    }).select().single();
    if (error) throw error;

    // Notify worker team of new client message (fire-and-forget)
    db.from('worker_notifications').insert({
      type: 'chat_message',
      message: `Nuevo mensaje de ${brand.name ?? 'cliente'}`,
      brand_id: brandId,
      brand_name: brand.name ?? null,
      read: false,
      metadata: { msg_id: msg.id },
    }).then(() => null).catch(() => null);

    return NextResponse.json({ message: msg });
  } catch (err: unknown) {
    const isPostgrest = err && typeof err === 'object' && 'code' in err;
    if (isPostgrest) {
      const e = err as { message?: string; details?: string; hint?: string; code?: string };
      console.error('[POST /api/chat] PostgREST', e);
      return NextResponse.json({ error: e.message, details: e.details, hint: e.hint, code: e.code }, { status: 500 });
    }
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('[POST /api/chat]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
