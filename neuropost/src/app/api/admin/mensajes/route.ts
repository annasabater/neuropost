import { NextResponse } from 'next/server';
import { requireSuperAdmin, adminErrorResponse } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    await requireSuperAdmin();
    const db = createAdminClient();
    const sp = new URL(request.url).searchParams;

    const status   = sp.get('status');
    const platform = sp.get('platform');
    const page     = Math.max(1, Number(sp.get('page') ?? 1));
    const pageSize = 25;

    // Return one row per thread (latest message per thread_id)
    let q = db
      .from('messages')
      .select('*, prospects(username, full_name, profile_pic_url)', { count: 'exact' });

    if (status)   q = q.eq('status', status);
    if (platform) q = q.eq('platform', platform);

    const { data, count, error } = await q
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) throw error;

    // Group by thread_id, keeping the latest per thread
    const threadsMap = new Map<string, typeof data[0]>();
    for (const msg of data ?? []) {
      const key = msg.thread_id ?? msg.id;
      if (!threadsMap.has(key)) threadsMap.set(key, msg);
    }

    const threads = Array.from(threadsMap.values());

    return NextResponse.json({ threads, total: count ?? 0, page, pageSize });
  } catch (err) {
    const { error, status } = adminErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
