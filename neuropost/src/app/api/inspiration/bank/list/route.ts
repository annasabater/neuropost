// =============================================================================
// NEUROPOST — Inspiration Bank listing (client-facing)
// Returns a sanitised view of inspiration_bank rows. Hidden prompts are NEVER
// returned to the browser.
// =============================================================================

import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { apiError } from '@/lib/api-utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

const DEFAULT_LIMIT = 24;
const MAX_LIMIT     = 60;

// Columns we expose to the client — no hidden_prompt / slide_prompts / scene_prompts
const PUBLIC_COLUMNS =
  'id, media_type, media_urls, thumbnail_url, video_frames_urls, ' +
  'category, tags, dominant_colors, mood, source_platform, source_url, created_at';

export async function GET(request: Request) {
  try {
    const user     = await requireServerUser();
    const supabase = await createServerClient() as DB;

    const url = new URL(request.url);
    const categoryParam = url.searchParams.get('category');  // explicit category filter
    const scopeParam    = url.searchParams.get('scope');     // 'all' → no category filter
    const search        = (url.searchParams.get('search') ?? '').trim();
    const limit         = Math.min(
      Math.max(Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT) | 0, 1),
      MAX_LIMIT,
    );
    const offset        = Math.max(Number(url.searchParams.get('offset') ?? 0) | 0, 0);

    // Decide the category filter.
    //   - If ?category=xyz → use it.
    //   - Else if ?scope=all → no filter ("Explore all").
    //   - Else → default to the active brand's sector ("For you").
    let effectiveCategory: string | null = null;
    if (categoryParam && categoryParam.trim()) {
      effectiveCategory = categoryParam.trim();
    } else if (scopeParam !== 'all') {
      const { data: brand } = await supabase
        .from('brands')
        .select('sector')
        .eq('user_id', user.id)
        .single();
      if (brand?.sector) effectiveCategory = brand.sector as string;
    }

    // Build query
    let query = supabase
      .from('inspiration_bank')
      .select(PUBLIC_COLUMNS, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (effectiveCategory) {
      query = query.eq('category', effectiveCategory);
    }
    if (search) {
      // Match against tags or mood (cheap, no FTS needed for the Phase 4 scope)
      query = query.or(`mood.ilike.%${search}%,tags.cs.{${search}}`);
    }

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      items:       data ?? [],
      total:       count ?? 0,
      limit,
      offset,
      appliedCategory: effectiveCategory,
    });
  } catch (err) {
    return apiError(err, 'GET /api/inspiration/bank/list');
  }
}
