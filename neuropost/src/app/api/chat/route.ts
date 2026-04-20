import { NextRequest, NextResponse } from 'next/server';
import { requireServerUser, createAdminClient } from '@/lib/supabase';
import { queueJob } from '@/lib/agents/queue';
import { apiError, parsePagination } from '@/lib/api-utils';
import { rateLimitWrite } from '@/lib/ratelimit';

export async function GET(request: NextRequest) {
  try {
    const user = await requireServerUser();
    const db = createAdminClient();
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');
    const { limit, offset } = parsePagination(request, 200, 100);

    const { data: brand } = await db.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    const resolvedBrandId = brandId ?? brand.id;

    const { data: messages, error } = await db
      .from('chat_messages')
      .select('*')
      .eq('brand_id', resolvedBrandId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;

    // Reverse so oldest-first for display, but we fetched newest-first for pagination
    return NextResponse.json({ messages: (messages ?? []).reverse() });
  } catch (err) {
    return apiError(err, 'GET /api/chat');
  }
}

export async function POST(request: Request) {
  try {
    const rl = await rateLimitWrite(request);
    if (rl) return rl;

    const user = await requireServerUser();
    const db = createAdminClient();
    const body = await request.json();
    const { message, attachments = [], brandId: bodyBrandId } = body;

    if (!message?.trim() && (!attachments || attachments.length === 0)) {
      return NextResponse.json({ error: 'Message or attachment required' }, { status: 400 });
    }

    const { data: brand } = await db.from('brands').select('id, name, plan').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    const brandId = bodyBrandId ?? brand.id;

    const clientMessage = message?.trim() ?? '';

    const { data: msg, error } = await db.from('chat_messages').insert({
      brand_id: brandId,
      sender_id: user.id,
      sender_type: 'client',
      message: clientMessage,
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

    // Skip agent call if the message is empty (attachments-only)
    if (!clientMessage) {
      return NextResponse.json({ message: msg });
    }

    // Load the last 10 chat messages as context (oldest-first, excluding the one just inserted)
    const { data: historyRows } = await db
      .from('chat_messages')
      .select('sender_type, message, created_at')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(10);

    const messageHistory = (historyRows ?? [])
      .reverse()
      .slice(0, -1)  // drop the just-inserted message
      .map((m: { sender_type: string; message: string; created_at: string }) => ({
        sender: m.sender_type === 'client' ? 'client' as const : 'worker' as const,
        message: m.message,
        at: m.created_at,
      }));

    // Queue SupportAgent to resolve the chat message (fire-and-forget).
    queueJob({
      brand_id:     brandId,
      agent_type:   'support',
      action:       'resolve_ticket',
      input:        {
        source:         'chat',
        clientMessage,
        plan:           brand.plan ?? 'starter',
        messageHistory,
      },
      priority:     80,
      requested_by: 'client',
    }).catch(() => null);

    return NextResponse.json({ message: msg });
  } catch (err) {
    return apiError(err, 'POST /api/chat');
  }
}
