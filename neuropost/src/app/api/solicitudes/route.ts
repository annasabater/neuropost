import { NextResponse } from 'next/server';
import { requireServerUser, createAdminClient } from '@/lib/supabase';
import { queueJob } from '@/lib/agents/queue';

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

    // Notify worker team (fire and forget)
    void db.from('worker_notifications').insert({
      type: 'new_request',
      message: `Nueva solicitud especial de ${brand.name}: "${title}"`,
      brand_id: brand.id,
      brand_name: brand.name ?? null,
      read: false,
      metadata: { request_id: req.id, type },
    }).then(() => {});

    // Queue agent to process the special request (fire-and-forget)
    const prompt = `Solicitud: ${title.trim()}${description?.trim() ? `\n\nDetalles: ${description.trim()}` : ''}${type !== 'custom' ? `\nTipo de contenido: ${type}` : ''}`;
    queueJob({
      brand_id:     brand.id,
      agent_type:   'content',
      action:       'generate_ideas',
      input:        {
        source:      'special_request',
        request_id:  req.id,
        prompt,
        count:       3,
      },
      priority:     deadline_at ? 85 : 65,
      requested_by: 'client',
    }).catch(() => null);

    return NextResponse.json({ request: req });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
