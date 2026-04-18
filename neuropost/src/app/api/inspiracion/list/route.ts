// =============================================================================
// GET /api/inspiracion/list
// Unified inspiration feed (legacy inspiration_references + inspiration_bank)
// served via the `inspiration_unified` view. Client receives per-item flags
// that encode favorite/saved state for the active brand.
// =============================================================================

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

type Scope = 'all' | 'favorites' | 'guardadas' | 'sugerencias'
  | 'user_saved' | 'editorial' | 'ai_generated' | 'bank';

interface UnifiedRow {
  id:               string;
  source:           'legacy' | 'bank';
  media_type:       'image' | 'carousel' | 'video';
  media_urls:       string[];
  thumbnail_url:    string | null;
  category:         string | null;
  tags:             string[];
  dominant_colors:  string[] | null;
  mood:             string | null;
  created_at:       string;
  brand_id:         string | null;
  origin:           string | null;
  title:            string | null;
  notes:            string | null;
  video_frames_urls: string[] | null;
  source_platform:  string | null;
  source_url:       string | null;
}

export async function GET(request: Request) {
  try {
    const user = await requireServerUser();
    const db: DB = createAdminClient();

    const { data: brand } = await db
      .from('brands')
      .select('id, sector')
      .eq('user_id', user.id)
      .single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const url = new URL(request.url);
    const scope       = (url.searchParams.get('scope') ?? 'all') as Scope;
    const mediaType   = url.searchParams.get('media_type');
    const tagsParam   = url.searchParams.get('tags');
    const search      = url.searchParams.get('search')?.trim() ?? '';
    const collection  = url.searchParams.get('collection'); // uuid | 'unfiled' | null
    const page        = Math.max(1, Number(url.searchParams.get('page')     ?? '1'));
    const perPage     = Math.min(100, Math.max(1, Number(url.searchParams.get('per_page') ?? '24')));
    const tags        = tagsParam ? tagsParam.split(',').map(t => t.trim()).filter(Boolean) : [];

    // ── Resolve the set of (source, item_id) pairs to read, scope-dependent ──
    let favItemIds:   Array<{ source: 'legacy'|'bank'; item_id: string }> = [];
    let savedItemIds: Array<{ source: 'legacy'|'bank'; item_id: string }> = [];

    if (scope === 'favorites') {
      const { data } = await db
        .from('inspiration_favorites')
        .select('source, item_id, created_at')
        .eq('brand_id', brand.id)
        .order('created_at', { ascending: false });
      favItemIds = (data ?? []) as typeof favItemIds;
    }
    if (scope === 'guardadas') {
      let q = db
        .from('inspiration_saved')
        .select('source, item_id, collection_id, created_at')
        .eq('brand_id', brand.id);
      if (collection === 'unfiled')      q = q.is('collection_id', null);
      else if (collection && collection !== 'all') q = q.eq('collection_id', collection);
      const { data } = await q.order('created_at', { ascending: false });
      savedItemIds = (data ?? []) as typeof savedItemIds;
    }

    // ── Build the main query against the unified view ─────────────────────
    let query = db
      .from('inspiration_unified')
      .select('*', { count: 'exact' });

    if (scope === 'favorites' || scope === 'guardadas') {
      const pairs = scope === 'favorites' ? favItemIds : savedItemIds;
      if (pairs.length === 0) {
        return NextResponse.json({
          items: [], total: 0, page, per_page: perPage, pages: 0,
        });
      }
      // Supabase doesn't support composite IN easily — split by source.
      const legacyIds = pairs.filter(p => p.source === 'legacy').map(p => p.item_id);
      const bankIds   = pairs.filter(p => p.source === 'bank').map(p => p.item_id);
      const filters: string[] = [];
      if (legacyIds.length > 0) filters.push(`and(source.eq.legacy,id.in.(${legacyIds.join(',')}))`);
      if (bankIds.length > 0)   filters.push(`and(source.eq.bank,id.in.(${bankIds.join(',')}))`);
      if (filters.length === 1) {
        // single-source shortcut — more efficient for query planner
        if (legacyIds.length > 0) query = query.eq('source', 'legacy').in('id', legacyIds);
        else                       query = query.eq('source', 'bank').in('id', bankIds);
      } else {
        query = query.or(filters.join(','));
      }
    } else if (scope === 'sugerencias') {
      // Bank items whose category matches the brand's sector
      if (!brand.sector) {
        return NextResponse.json({ items: [], total: 0, page, per_page: perPage, pages: 0 });
      }
      query = query.eq('source', 'bank').eq('category', brand.sector);
    } else if (scope === 'editorial' || scope === 'user_saved' || scope === 'ai_generated') {
      // Legacy-only origins (kept for compat with any deep link)
      query = query.eq('source', 'legacy').eq('origin', scope)
        .or(`brand_id.eq.${brand.id},origin.eq.editorial`);
    } else if (scope === 'bank') {
      query = query.eq('source', 'bank');
    } else {
      // 'all' → bank items (public) + legacy items belonging to this brand
      query = query.or(`source.eq.bank,and(source.eq.legacy,brand_id.eq.${brand.id})`);
    }

    // ── Extra filters ─────────────────────────────────────────────────────
    if (mediaType) {
      const typeMap: Record<string, string[]> = {
        image:    ['image'],
        carousel: ['carousel'],
        video:    ['video'],
      };
      query = query.in('media_type', typeMap[mediaType] ?? [mediaType]);
    }
    if (tags.length > 0) query = query.overlaps('tags', tags);
    if (search) {
      // title/notes exist on legacy; mood/category exist on both; search
      // across the union's visible columns.
      query = query.or(
        `title.ilike.%${search}%,notes.ilike.%${search}%,mood.ilike.%${search}%,category.ilike.%${search}%`,
      );
    }

    query = query.order('created_at', { ascending: false });

    const from = (page - 1) * perPage;
    query = query.range(from, from + perPage - 1);

    const { data: rawItems, error, count } = await query;
    if (error) throw error;

    const items = (rawItems ?? []) as UnifiedRow[];

    // ── Enrich with favorite/saved state for the active brand ─────────────
    // Only look up rows we're about to return (bounded by perPage).
    const keys = items.map(i => ({ source: i.source, id: i.id }));
    const legacyIds = keys.filter(k => k.source === 'legacy').map(k => k.id);
    const bankIds   = keys.filter(k => k.source === 'bank').map(k => k.id);

    const [favRowsLegacy, favRowsBank, savedRowsLegacy, savedRowsBank] = await Promise.all([
      legacyIds.length > 0
        ? db.from('inspiration_favorites').select('item_id').eq('brand_id', brand.id).eq('source', 'legacy').in('item_id', legacyIds)
        : { data: [] },
      bankIds.length > 0
        ? db.from('inspiration_favorites').select('item_id').eq('brand_id', brand.id).eq('source', 'bank').in('item_id', bankIds)
        : { data: [] },
      legacyIds.length > 0
        ? db.from('inspiration_saved').select('item_id, collection_id').eq('brand_id', brand.id).eq('source', 'legacy').in('item_id', legacyIds)
        : { data: [] },
      bankIds.length > 0
        ? db.from('inspiration_saved').select('item_id, collection_id').eq('brand_id', brand.id).eq('source', 'bank').in('item_id', bankIds)
        : { data: [] },
    ]);

    const favSet = new Set<string>();
    for (const r of [...(favRowsLegacy.data ?? []), ...(favRowsBank.data ?? [])]) {
      favSet.add((r as { item_id: string }).item_id);
    }
    const savedMap = new Map<string, string[]>();
    for (const r of [...(savedRowsLegacy.data ?? []), ...(savedRowsBank.data ?? [])]) {
      const row = r as { item_id: string; collection_id: string | null };
      const list = savedMap.get(row.item_id) ?? [];
      if (row.collection_id) list.push(row.collection_id);
      savedMap.set(row.item_id, list);
    }

    const enriched = items.map(it => ({
      ...it,
      is_favorite:          favSet.has(it.id),
      is_saved:             savedMap.has(it.id),
      saved_collection_ids: savedMap.get(it.id) ?? [],
    }));

    return NextResponse.json({
      items:    enriched,
      total:    count ?? 0,
      page,
      per_page: perPage,
      pages:    Math.ceil((count ?? 0) / perPage),
    });
  } catch (err) {
    return apiError(err, 'inspiracion/list');
  }
}
