import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

// GET /api/inspiracion/list
// Unified filtered list for the Inspiration Library.
//
// Query params:
//   scope          'all' | 'favorites' | 'user_saved' | 'editorial' | 'ai_generated'
//                  (default: 'all')
//   origin         'editorial' | 'user_saved' | 'ai_generated' (alias for scope when origin)
//   media_type     'image' | 'carousel' | 'video'
//   tags           comma-separated list of tags to match (any match)
//   search         free-text search on title, notes, description_short
//   sort           'recent' (default)
//   page           integer >= 1  (default: 1)
//   per_page       integer 1-100 (default: 24)
export async function GET(request: Request) {
  try {
    const user = await requireServerUser();
    const db: DB = createAdminClient();

    const { data: brand } = await db
      .from('brands')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const url = new URL(request.url);
    const scope     = url.searchParams.get('scope')     ?? 'all';
    const mediaType = url.searchParams.get('media_type');
    const tagsParam = url.searchParams.get('tags');
    const search    = url.searchParams.get('search')?.trim() ?? '';
    const page      = Math.max(1, Number(url.searchParams.get('page')     ?? '1'));
    const perPage   = Math.min(100, Math.max(1, Number(url.searchParams.get('per_page') ?? '24')));
    const tags      = tagsParam ? tagsParam.split(',').map(t => t.trim()).filter(Boolean) : [];

    let query = db
      .from('inspiration_references')
      .select('*', { count: 'exact' })
      .eq('brand_id', brand.id)
      .eq('is_saved', true);

    // ── Scope / origin filter ─────────────────────────────────────────────────
    if (scope === 'favorites') {
      query = query.eq('is_favorite', true);
    } else if (scope === 'editorial' || scope === 'user_saved' || scope === 'ai_generated') {
      query = query.eq('origin', scope);
    }
    // 'all' → no extra filter

    // ── Media type ────────────────────────────────────────────────────────────
    if (mediaType) {
      const typeMap: Record<string, string[]> = {
        image:    ['image', 'foto', 'imagen'],
        carousel: ['carousel', 'carrusel'],
        video:    ['video', 'reel'],
      };
      const dbTypes = typeMap[mediaType] ?? [mediaType];
      query = query.in('type', dbTypes);
    }

    // ── Tag filter (overlap: at least one tag matches) ────────────────────────
    if (tags.length > 0) {
      query = query.overlaps('tags', tags);
    }

    // ── Full-text search ──────────────────────────────────────────────────────
    if (search) {
      query = query.or(
        `title.ilike.%${search}%,notes.ilike.%${search}%,description_short.ilike.%${search}%`,
      );
    }

    // ── Sort: always most recent first (client-facing) ────────────────────────
    query = query.order('created_at', { ascending: false });

    // ── Pagination ────────────────────────────────────────────────────────────
    const from = (page - 1) * perPage;
    const to   = from + perPage - 1;
    query = query.range(from, to);

    const { data: items, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({
      items:    items ?? [],
      total:    count ?? 0,
      page,
      per_page: perPage,
      pages:    Math.ceil((count ?? 0) / perPage),
    });
  } catch (err) {
    return apiError(err, 'inspiracion/list');
  }
}
