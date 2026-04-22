import { NextResponse } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const worker = await requireWorker();
    const db = createAdminClient();
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const priority = searchParams.get('priority');

    let query = db.from('support_tickets').select('*, brands(id, name)').order('created_at', { ascending: false });

    if (worker.role === 'worker' && worker.brands_assigned?.length) {
      query = query.in('brand_id', worker.brands_assigned);
    }
    if (statusFilter) query = query.eq('status', statusFilter);
    if (priority) query = query.eq('priority', priority);

    const { data: tickets, error } = await query;
    if (error) throw error;

    return NextResponse.json({ tickets: tickets ?? [] });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireWorker();
    const db = createAdminClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const body = await request.json();
    const { status, resolution, message: replyMsg } = body;

    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (resolution) updates.resolution = resolution;
    if (status === 'resolved') updates.resolved_at = new Date().toISOString();

    const { data: ticket, error } = await db
      .from('support_tickets')
      .update(updates)
      .eq('id', id)
      .select('*, brands(id)')
      .single();
    if (error) throw error;

    if (replyMsg?.trim()) {
      await db.from('support_ticket_messages').insert({
        ticket_id: id,
        sender_type: 'worker',
        message: replyMsg.trim(),
      });
    }

    const brandId = (ticket.brands as any)?.id;
    if (brandId && status) {
      const notif = (() => {
        switch (status) {
          case 'in_progress': return { type: 'ticket_accepted', message: 'Tu ticket ha sido aceptado y está en proceso' };
          case 'resolved':    return { type: 'ticket_resolved', message: 'Tu ticket de soporte ha sido resuelto' };
          case 'closed':      return { type: 'ticket_rejected', message: 'Tu ticket ha sido cerrado por el equipo' };
          default:            return null;
        }
      })();
      if (notif) {
        try {
          await db.from('notifications').insert({
            brand_id: brandId,
            type: notif.type,
            message: notif.message,
            read: false,
            metadata: { ticket_id: id },
          });
        } catch { /* non-critical */ }
      }
    }

    return NextResponse.json({ ticket });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
