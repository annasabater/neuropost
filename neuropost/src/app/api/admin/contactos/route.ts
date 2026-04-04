import { NextResponse } from 'next/server';
import { requireSuperAdmin, adminErrorResponse } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    await requireSuperAdmin();
    const db = createAdminClient();
    const sp = new URL(request.url).searchParams;

    const status   = sp.get('status');
    const search   = sp.get('q');
    const page     = Math.max(1, Number(sp.get('page') ?? 1));
    const pageSize = 25;

    let q = db.from('contact_requests').select('*', { count: 'exact' });
    if (status) q = q.eq('status', status);
    if (search) q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%,message.ilike.%${search}%`);

    const { data, count, error } = await q
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) throw error;
    return NextResponse.json({ contacts: data ?? [], total: count ?? 0, page, pageSize });
  } catch (err) {
    const { error, status } = adminErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireSuperAdmin();
    const db   = createAdminClient();
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) return NextResponse.json({ error: 'id y status requeridos' }, { status: 400 });

    const { data, error } = await db
      .from('contact_requests')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ contact: data });
  } catch (err) {
    const { error, status } = adminErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
