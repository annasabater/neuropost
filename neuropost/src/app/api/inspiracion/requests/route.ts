// GET /api/inspiracion/requests — list reference requests for the active brand

import { NextResponse }                          from 'next/server';
import { requireServerUser, createAdminClient }  from '@/lib/supabase';
import { apiError }                              from '@/lib/api-utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

const VALID_STATUSES = ['pending', 'in_progress', 'scheduled', 'published', 'cancelled'];

export async function GET(request: Request) {
  try {
    const user = await requireServerUser();
    const db: DB = createAdminClient();

    const { data: brand } = await db
      .from('brands')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (!brand) return NextResponse.json({ requests: [] });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = db
      .from('reference_requests')
      .select('*')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false });

    if (status && VALID_STATUSES.includes(status)) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Enrich with thumbnail from the referenced item
    const rows = (data ?? []) as Array<{
      id: string; source: string; item_id: string;
      status: string; client_comment: string | null;
      timing_preference: string | null; preferred_date: string | null;
      created_at: string; scheduled_for: string | null;
      published_at: string | null; cancelled_at: string | null;
    }>;

    const bankIds   = rows.filter(r => r.source === 'bank').map(r => r.item_id);
    const legacyIds = rows.filter(r => r.source === 'legacy').map(r => r.item_id);

    const [bankItems, legacyItems] = await Promise.all([
      bankIds.length > 0
        ? db.from('inspiration_bank').select('id, thumbnail_url, media_urls, category, tags').in('id', bankIds)
        : { data: [] },
      legacyIds.length > 0
        ? db.from('inspiration_references').select('id, thumbnail_url, source_url, title').in('id', legacyIds)
        : { data: [] },
    ]);

    const thumbMap = new Map<string, { thumbnail_url: string | null; label: string | null }>();
    for (const b of (bankItems.data ?? [])) {
      thumbMap.set(b.id, { thumbnail_url: b.thumbnail_url ?? b.media_urls?.[0] ?? null, label: b.category ?? null });
    }
    for (const l of (legacyItems.data ?? [])) {
      thumbMap.set(l.id, { thumbnail_url: l.thumbnail_url ?? null, label: l.title ?? null });
    }

    const enriched = rows.map(r => ({
      ...r,
      thumbnail_url: thumbMap.get(r.item_id)?.thumbnail_url ?? null,
      item_label:    thumbMap.get(r.item_id)?.label ?? null,
    }));

    return NextResponse.json({ requests: enriched });
  } catch (err) {
    return apiError(err, 'GET /api/inspiracion/requests');
  }
}
