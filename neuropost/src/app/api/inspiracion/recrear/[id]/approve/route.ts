// POST /api/inspiracion/recrear/[id]/approve
// Client approves the generated images — moves status to 'completed'.

import { NextResponse } from 'next/server';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireServerUser();
    const { id } = await params;
    const db: DB = createAdminClient();

    const { data: brand } = await db
      .from('brands')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { error } = await db
      .from('recreation_requests')
      .update({ status: 'completed' })
      .eq('id', id)
      .eq('brand_id', brand.id);

    if (error) throw error;

    return NextResponse.json({ ok: true, status: 'completed' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('[POST /api/inspiracion/recrear/[id]/approve]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
