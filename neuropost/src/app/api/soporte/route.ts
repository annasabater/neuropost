import { NextResponse } from 'next/server';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

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

    return NextResponse.json({ ticket });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
