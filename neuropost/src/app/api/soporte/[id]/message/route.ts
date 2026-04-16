import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createAdminClient } from '@/lib/supabase';
import { queueJob } from '@/lib/agents/queue';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireServerUser();
    const db = createAdminClient();
    const { message } = await request.json();

    if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 });

    const { data: brand } = await db.from('brands').select('id, name, plan').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { data: ticket } = await db.from('support_tickets').select('id, brand_id, subject, priority, category').eq('id', id).eq('brand_id', brand.id).single();
    if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { data: msg, error } = await db.from('support_ticket_messages').insert({
      ticket_id: id,
      sender_id: user.id,
      sender_type: 'client',
      message: message.trim(),
    }).select().single();
    if (error) throw error;

    // Load the last 10 messages as context for the agent (oldest first)
    const { data: historyRows } = await db
      .from('support_ticket_messages')
      .select('sender_type, message, created_at')
      .eq('ticket_id', id)
      .order('created_at', { ascending: false })
      .limit(10);

    const messageHistory = (historyRows ?? [])
      .reverse()
      .slice(0, -1)  // drop the just-inserted one (it's the new message being responded to)
      .map((m: { sender_type: string; message: string; created_at: string }) => ({
        sender: m.sender_type === 'client' ? 'client' as const : 'worker' as const,
        message: m.message,
        at: m.created_at,
      }));

    // Queue SupportAgent to resolve the follow-up message (fire-and-forget).
    queueJob({
      brand_id:     brand.id,
      agent_type:   'support',
      action:       'resolve_ticket',
      input:        {
        source:            'ticket',
        ticket_id:         id,
        clientMessage:     message.trim(),
        subject:           ticket.subject ?? undefined,
        priority:          ticket.priority ?? 'normal',
        declaredCategory:  ticket.category ?? undefined,
        plan:              brand.plan ?? 'starter',
        messageHistory,
      },
      priority:     75,
      requested_by: 'client',
    }).catch(() => null);

    return NextResponse.json({ message: msg });
  } catch (err) {
    return apiError(err, 'soporte/[id]/message');
  }
}
