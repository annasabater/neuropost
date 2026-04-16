import { NextResponse } from 'next/server';
import { requireServerUser, createAdminClient } from '@/lib/supabase';
import { sendUrgentTicketEmail } from '@/lib/email';
import { queueJob } from '@/lib/agents/queue';
import { apiError, parsePagination } from '@/lib/api-utils';
import { rateLimitWrite } from '@/lib/ratelimit';

export async function GET(request: Request) {
  try {
    const user = await requireServerUser();
    const db = createAdminClient();
    const { limit, offset } = parsePagination(request, 100, 50);

    const { data: brand } = await db.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { data: tickets, error } = await db
      .from('support_tickets')
      .select('*')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;

    return NextResponse.json({ tickets: tickets ?? [] });
  } catch (err) {
    return apiError(err, 'GET /api/soporte');
  }
}

export async function POST(request: Request) {
  try {
    const rl = await rateLimitWrite(request);
    if (rl) return rl;

    const user = await requireServerUser();
    const db = createAdminClient();
    const body = await request.json();
    const { subject, description, category = 'other', priority = 'normal' } = body;

    if (!subject?.trim()) return NextResponse.json({ error: 'Subject required' }, { status: 400 });
    if (!description?.trim()) return NextResponse.json({ error: 'Description required' }, { status: 400 });

    const { data: brand } = await db.from('brands').select('id, name, plan').eq('user_id', user.id).single();
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

    // Queue SupportAgent to resolve the new ticket (fire-and-forget).
    // Uses the dedicated action 'resolve_ticket' which ALWAYS returns a reply.
    queueJob({
      brand_id:     brand.id,
      agent_type:   'support',
      action:       'resolve_ticket',
      input:        {
        source:            'ticket',
        ticket_id:         ticket.id,
        clientMessage:     description?.trim() ?? subject.trim(),
        subject:           subject.trim(),
        priority,
        declaredCategory:  category,
        plan:              brand.plan ?? 'starter',
        messageHistory:    [],  // first message, no history yet
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
        }).catch((emailErr) => console.error('[soporte] urgent email failed:', emailErr));
      }
    }

    return NextResponse.json({ ticket });
  } catch (err) {
    return apiError(err, 'POST /api/soporte');
  }
}
