// POST /api/inspiracion/requests/[id]/cancel

import { NextResponse }                          from 'next/server';
import { requireServerUser, createAdminClient }  from '@/lib/supabase';
import { apiError }                              from '@/lib/api-utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await requireServerUser();
    const db: DB = createAdminClient();

    const { data: brand } = await db
      .from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { data: req } = await db
      .from('reference_requests')
      .select('id, status, brand_id')
      .eq('id', id)
      .eq('brand_id', brand.id)
      .single();

    if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (req.status !== 'pending') {
      return NextResponse.json({ error: 'Only pending requests can be cancelled' }, { status: 400 });
    }

    const { error } = await db
      .from('reference_requests')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, 'POST /api/inspiracion/requests/[id]/cancel');
  }
}
