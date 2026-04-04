import { NextResponse } from 'next/server';
import { requireSuperAdmin, adminErrorResponse } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    await requireSuperAdmin();
    const db = createAdminClient();
    const sp = new URL(request.url).searchParams;

    const channel  = sp.get('channel');
    const status   = sp.get('status');
    const sector   = sp.get('sector');
    const city     = sp.get('city');
    const search   = sp.get('q');
    const page     = Math.max(1, Number(sp.get('page') ?? 1));
    const pageSize = 25;

    let q = db.from('prospects').select('*', { count: 'exact' });

    if (channel) q = q.eq('channel', channel);
    if (status)  q = q.eq('status',  status);
    if (sector)  q = q.eq('sector',  sector);
    if (city)    q = q.ilike('city', `%${city}%`);
    if (search)  q = q.or(`username.ilike.%${search}%,full_name.ilike.%${search}%,email.ilike.%${search}%`);

    const { data, count, error } = await q
      .order('last_activity', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) throw error;

    return NextResponse.json({ prospects: data ?? [], total: count ?? 0, page, pageSize });
  } catch (err) {
    const { error, status } = adminErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function POST(request: Request) {
  try {
    await requireSuperAdmin();
    const db   = createAdminClient();
    const body = await request.json();

    const { data, error } = await db
      .from('prospects')
      .insert({ ...body, last_activity: new Date().toISOString() })
      .select()
      .single();

    if (error) throw error;

    // Log interaction
    await db.from('prospect_interactions').insert({
      prospect_id: data.id,
      type:        'comment_sent',
      content:     body.notes ?? 'Prospect añadido',
    });

    return NextResponse.json({ prospect: data }, { status: 201 });
  } catch (err) {
    const { error, status } = adminErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
