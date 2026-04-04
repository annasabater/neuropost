import { NextResponse } from 'next/server';
import { requireSuperAdmin, adminErrorResponse } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    await requireSuperAdmin();
    const db = createAdminClient();
    const sp = new URL(request.url).searchParams;

    const status  = sp.get('status');
    const page    = Math.max(1, Number(sp.get('page') ?? 1));
    const pageSize = 25;

    let q = db
      .from('outbound_comments')
      .select('*, prospects(username, full_name, profile_pic_url)', { count: 'exact' });

    if (status) q = q.eq('status', status);

    const { data, count, error } = await q
      .order('sent_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) throw error;

    return NextResponse.json({ comments: data ?? [], total: count ?? 0, page, pageSize });
  } catch (err) {
    const { error, status } = adminErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
