import { NextResponse }      from 'next/server';
import { requireWorker }     from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';
import { apiError }          from '@/lib/api-utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireWorker();
    const { id } = await params;
    const db = createAdminClient() as DB;

    const { data: plan, error: planErr } = await db
      .from('weekly_plans')
      .select('*, brands ( name )')
      .eq('id', id)
      .single();

    if (planErr || !plan) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { data: ideas, error: ideasErr } = await db
      .from('content_ideas')
      .select('*')
      .eq('week_id', id)
      .order('position', { ascending: true });

    if (ideasErr) throw ideasErr;

    return NextResponse.json({ plan, ideas: ideas ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return apiError(err, 'GET /api/worker/weekly-plans/[id]');
  }
}
