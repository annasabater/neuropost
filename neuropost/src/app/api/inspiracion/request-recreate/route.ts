// POST /api/inspiracion/request-recreate
// Creates a reference_request for a saved inspiration item.

import { NextResponse }                          from 'next/server';
import { requireServerUser, createAdminClient }  from '@/lib/supabase';
import { apiError }                              from '@/lib/api-utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function POST(request: Request) {
  try {
    const user = await requireServerUser();
    const db: DB = createAdminClient();

    const { data: brand } = await db
      .from('brands')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const body = await request.json() as {
      source:             'bank' | 'legacy';
      item_id:            string;
      client_comment?:    string | null;
      timing_preference?: 'asap' | 'next_two_weeks' | 'specific_date';
      preferred_date?:    string | null;
    };

    if (!body.source || !body.item_id) {
      return NextResponse.json({ error: 'source and item_id are required' }, { status: 400 });
    }

    const { data: req, error } = await db
      .from('reference_requests')
      .insert({
        brand_id:           brand.id,
        source:             body.source,
        item_id:            body.item_id,
        status:             'pending',
        client_comment:     body.client_comment ?? null,
        timing_preference:  body.timing_preference ?? 'next_two_weeks',
        preferred_date:     body.preferred_date   ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, request: req });
  } catch (err) {
    return apiError(err, 'POST /api/inspiracion/request-recreate');
  }
}
