import { NextResponse } from 'next/server';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

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

    const { data: brand } = await db.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { data: ticket } = await db.from('support_tickets').select('id, brand_id').eq('id', id).eq('brand_id', brand.id).single();
    if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { data: msg, error } = await db.from('support_ticket_messages').insert({
      ticket_id: id,
      sender_id: user.id,
      sender_type: 'client',
      message: message.trim(),
    }).select().single();
    if (error) throw error;

    return NextResponse.json({ message: msg });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
