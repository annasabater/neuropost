import { NextResponse } from 'next/server';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const user = await requireServerUser();
    const db = createAdminClient();

    const { data: brand } = await db.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { data: requests, error } = await db
      .from('special_requests')
      .select('*')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return NextResponse.json({ requests: requests ?? [] });
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
    const { title, description, type = 'custom', deadline_at } = body;

    if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 });

    const { data: brand } = await db.from('brands').select('id, name').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { data: req, error } = await db.from('special_requests').insert({
      brand_id: brand.id,
      title: title.trim(),
      description: description?.trim() ?? null,
      type,
      deadline_at: deadline_at ?? null,
      status: 'pending',
    }).select().single();
    if (error) throw error;

    // Notify workers
    await db.from('notifications').insert({
      brand_id: brand.id,
      type: 'new_request',
      message: `Nueva solicitud especial de ${brand.name}: "${title}"`,
      read: false,
      metadata: { request_id: req.id },
    }).catch(() => null);

    return NextResponse.json({ request: req });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
