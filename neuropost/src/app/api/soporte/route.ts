import { NextResponse } from 'next/server';
import { requireServerUser, createAdminClient } from '@/lib/supabase';
import { sendUrgentTicketEmail } from '@/lib/email';
import { queueJob } from '@/lib/agents/queue';

export async function GET() {
  try {
    const user = await requireServerUser();
    const db = createAdminClient();

    const { data: brand } = await db.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { data: tickets, error } = await db
      .from('support_tickets')
      .select('*')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return NextResponse.json({ tickets: tickets ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireServerUser();
    const db = createAdminClient();
    const body = await request.json();
    const { subject, description, category = 'other', priority = 'normal' } = body;

    if (!subject?.trim()) return NextResponse.json({ error: 'Subject required' }, { status: 400 });

    const { data: brand } = await db.from('brands').select('id, name').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { data: ticket, error } = await db.from('support_tickets').insert({
      brand_id: brand.id,
      subject: subject.trim(),
      description: description?.trim() ?? null,
      category,
      priority,
      status: 'open',
    }).select().single();
    if (error) throw error;

    // Initial message from client
    if (description?.trim()) {
      await db.from('support_ticket_messages').insert({
        ticket_id: ticket.id,
        sender_id: user.id,
        sender_type: 'client',
        message: description.trim(),
      });
    }

    // Queue agent to handle the new support ticket (fire-and-forget)
    queueJob({
      brand_id:     brand.id,
      agent_type:   'support',
      action:       'handle_interactions',
      input:        {
        source:      'ticket',
        ticket_id:   ticket.id,
        subject:     subject.trim(),
        description: description?.trim() ?? '',
        category,
        urgency:     priority,
      },
      priority:     priority === 'urgent' ? 90 : 70,
      requested_by: 'client',
    }).catch(() => null);

    // Notify worker team of new support ticket (fire-and-forget)
    db.from('worker_notifications').insert({
      type: 'support_ticket',
      message: `Nuevo ticket de soporte de ${brand.name}: "${subject.trim()}"`,
      brand_id: brand.id,
      brand_name: brand.name ?? null,
      read: false,
      metadata: { ticketId: ticket.id, category, priority },
    }).then(() => null).catch(() => null);

    // Urgent tickets → email directo al administrador para gestión manual
    if (priority === 'urgent') {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        sendUrgentTicketEmail({
          to:          adminEmail,
          brandName:   brand.name ?? 'Cliente',
          subject:     subject.trim(),
          description: description?.trim() ?? '',
          category,
          ticketId:    ticket.id,
          clientEmail: user.email ?? '',
        }).catch((err) => console.error('[soporte] urgent email failed:', err));
      }
    }

    return NextResponse.json({ ticket });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
