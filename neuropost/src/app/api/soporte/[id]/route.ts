import { NextResponse } from 'next/server';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireServerUser();
    const db = createAdminClient();

    const { data: brand } = await db.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { data: ticket, error } = await db
      .from('support_tickets')
      .select('*')
      .eq('id', id)
      .eq('brand_id', brand.id)
      .single();
    if (error || !ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { data: messages } = await db
      .from('support_ticket_messages')
      .select('*')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true });

    return NextResponse.json({ ticket, messages: messages ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireServerUser();
    const db = createAdminClient();
    const body = await request.json();

    const { data: brand } = await db.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    // Clients can reopen or rate resolved tickets
    const { status, satisfaction_rating } = body;
    const updates: Record<string, unknown> = {};
    if (status === 'open') updates.status = 'open'; // reopen
    if (satisfaction_rating) updates.satisfaction_rating = satisfaction_rating;

    const { data: ticket, error } = await db
      .from('support_tickets')
      .update(updates)
      .eq('id', id)
      .eq('brand_id', brand.id)
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ ticket });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
