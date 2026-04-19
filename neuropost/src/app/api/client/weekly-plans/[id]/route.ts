import { NextResponse }              from 'next/server';
import { requireServerUser }         from '@/lib/supabase';
import { createAdminClient }         from '@/lib/supabase';
import { apiError }                  from '@/lib/api-utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireServerUser();
    const { id } = await params;
    const db = createAdminClient() as DB;

    const { data: plan, error: planErr } = await db
      .from('weekly_plans')
      .select('*, brands!inner ( name, user_id )')
      .eq('id', id)
      .single();

    if (planErr || !plan) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // RLS: plan must belong to a brand owned by the requesting user
    if (plan.brands?.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: ideas, error: ideasErr } = await db
      .from('content_ideas')
      .select('*')
      .eq('week_id', id)
      .order('position', { ascending: true });

    if (ideasErr) throw ideasErr;

    return NextResponse.json({ plan, ideas: ideas ?? [] });
  } catch (err) {
    return apiError(err, 'GET /api/client/weekly-plans/[id]');
  }
}
