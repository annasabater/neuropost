import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireWorker } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    await requireWorker();
    const db = createAdminClient();

    const { data, error } = await db
      .from('worker_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;

    return NextResponse.json({ notifications: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return apiError(err, 'worker/notifications');
  }
}

export async function PATCH(request: Request) {
  try {
    await requireWorker();
    const db = createAdminClient();
    const body = await request.json() as { ids?: string[]; all?: boolean };

    let query = db.from('worker_notifications').update({ read: true });
    if (!body.all && body.ids?.length) {
      query = query.in('id', body.ids);
    }
    await query;

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return apiError(err, 'worker/notifications');
  }
}
