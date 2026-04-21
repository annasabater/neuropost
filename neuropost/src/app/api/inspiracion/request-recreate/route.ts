// POST /api/inspiracion/request-recreate
// Creates a reference_request for a saved inspiration item.

import { NextResponse }                          from 'next/server';
import { requireServerUser, createAdminClient }  from '@/lib/supabase';
import { apiError }                              from '@/lib/api-utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

// Map UI timing values → DB-safe values (original constraint only knows these three)
const TIMING_MAP: Record<string, string> = {
  next_week:      'next_two_weeks',
  next_two_weeks: 'next_two_weeks',
  asap:           'asap',
  specific_date:  'specific_date',
};

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
      timing_preference?: string;
      preferred_date?:    string | null;
      own_media_urls?:    string[];
    };

    if (!body.source || !body.item_id) {
      return NextResponse.json({ error: 'source and item_id are required' }, { status: 400 });
    }

    const safeTimingPref = TIMING_MAP[body.timing_preference ?? 'next_two_weeks'] ?? 'next_two_weeks';
    const ownMedia = body.own_media_urls?.filter(Boolean) ?? [];

    // Build base insert (always valid against original schema)
    const baseInsert = {
      brand_id:           brand.id,
      source:             body.source,
      item_id:            body.item_id,
      status:             'pending',
      client_comment:     body.client_comment?.trim() || null,
      timing_preference:  safeTimingPref,
      preferred_date:     safeTimingPref === 'specific_date' ? (body.preferred_date ?? null) : null,
    };

    // Try with own_media_urls first (requires migration 20260421_reference_requests_media.sql)
    let result = await db
      .from('reference_requests')
      .insert({ ...baseInsert, own_media_urls: ownMedia })
      .select()
      .single();

    // Fallback: if own_media_urls column doesn't exist yet, retry without it
    // and encode media URLs in internal_notes as JSON
    if (result.error?.message?.includes('own_media_urls') || result.error?.code === '42703') {
      const fallbackInsert = ownMedia.length
        ? { ...baseInsert, internal_notes: JSON.stringify({ own_media_urls: ownMedia }) }
        : baseInsert;

      result = await db
        .from('reference_requests')
        .insert(fallbackInsert)
        .select()
        .single();
    }

    if (result.error) throw result.error;

    return NextResponse.json({ ok: true, request: result.data });
  } catch (err) {
    return apiError(err, 'POST /api/inspiracion/request-recreate');
  }
}
