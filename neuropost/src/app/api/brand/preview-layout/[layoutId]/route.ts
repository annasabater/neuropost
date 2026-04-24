// =============================================================================
// GET /api/brand/preview-layout/[layoutId]?brand_id=...
// =============================================================================
// Phase 2.C — Layouts Gallery preview endpoint.
// Renders one layout from LAYOUT_CATALOG with the caller's brand kit
// (colors, fonts, overlay_intensity, logo) and a demo copy tailored to the
// layout's best_for. If the brand has images in its inspiration pool we pick
// one; otherwise we fall back to picsum.
//
// Auth: requireServerUser + ownership check on brands.user_id.
// Cache: 5-min browser cache + 10-min CDN cache with an ETag.
// =============================================================================

import { NextResponse }                                 from 'next/server';
import { requireServerUser, createServerClient }        from '@/lib/supabase';
import { apiError }                                     from '@/lib/api-utils';
import { renderStory }                                  from '@/lib/stories/render';
import { LAYOUT_CATALOG }                               from '@/lib/stories/layouts-catalog';
import type { LayoutDefinition }                        from '@/lib/stories/layouts-catalog';
import type { Brand, ContentIdea }                      from '@/types';
import { createHash }                                   from 'node:crypto';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

const RENDER_TIMEOUT_MS = 15_000;

function demoCopyFor(layout: LayoutDefinition): string {
  const best = new Set(layout.best_for);
  if (layout.id === 'compare_split')          return 'Bàsic | Premium\nDes de 29€ | Des de 59€';
  if (layout.id === 'story_numbered_series')  return '01\nLa nostra filosofia\nPetits detalls, grans resultats.\nCada projecte és únic.';
  if (best.has('schedule')) {
    return 'DL: 9:00-21:00\nDT: 9:00-21:00\nDC: 9:00-21:00\nDJ: 9:00-21:00\nDV: 9:00-21:00\nDS: 10:00-14:00\nDG: Tancat';
  }
  if (best.has('data'))  return '87%\nde clients satisfets';
  if (best.has('promo')) return '20% de descompte\naquesta setmana\nReserva ara';
  if (best.has('quote')) return 'La constància és el camí cap a l\'èxit.';
  return 'El teu negoci, la teva veu';
}

async function pickSampleImage(supabase: DB, brandId: string): Promise<string | null> {
  // 1. Legacy inspiration_references owned by the brand.
  const legacy = await supabase
    .from('inspiration_unified')
    .select('thumbnail_url, media_urls')
    .eq('source',   'legacy')
    .eq('brand_id', brandId)
    .not('thumbnail_url', 'is', null)
    .limit(1)
    .maybeSingle();
  const legacyRow = legacy.data as { thumbnail_url: string | null; media_urls: string[] | null } | null;
  if (legacyRow?.thumbnail_url) return legacyRow.thumbnail_url;
  if (legacyRow?.media_urls?.[0]) return legacyRow.media_urls[0];

  // 2. Global inspiration_bank.
  const bank = await supabase
    .from('inspiration_unified')
    .select('thumbnail_url, media_urls')
    .eq('source', 'bank')
    .not('thumbnail_url', 'is', null)
    .limit(1)
    .maybeSingle();
  const bankRow = bank.data as { thumbnail_url: string | null; media_urls: string[] | null } | null;
  if (bankRow?.thumbnail_url) return bankRow.thumbnail_url;
  if (bankRow?.media_urls?.[0]) return bankRow.media_urls[0];

  return null;
}

function buildETag(brand: Brand, layoutId: string): string {
  const updated = (brand as unknown as Record<string, unknown>).updated_at ?? '';
  return '"' + createHash('sha1').update(`${brand.id}:${updated}:${layoutId}`).digest('hex') + '"';
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ layoutId: string }> },
) {
  try {
    const { layoutId } = await params;
    const layout = LAYOUT_CATALOG.find(l => l.id === layoutId);
    if (!layout) {
      return NextResponse.json({ error: 'layout not found' }, { status: 404 });
    }

    const brandId = new URL(request.url).searchParams.get('brand_id');
    if (!brandId) {
      return NextResponse.json({ error: 'brand_id query param required' }, { status: 400 });
    }

    const user     = await requireServerUser();
    const supabase = await createServerClient() as DB;

    // Load brand scoped to the authenticated user (ownership check in one query).
    const { data: brandRow } = await supabase
      .from('brands')
      .select('*')
      .eq('id',      brandId)
      .eq('user_id', user.id)
      .single();
    const brand = brandRow as Brand | null;
    if (!brand) {
      return NextResponse.json({ error: 'brand not found or not owned' }, { status: 403 });
    }

    // ETag short-circuit: respond 304 if client already has this version cached.
    const etag         = buildETag(brand, layoutId);
    const ifNoneMatch  = request.headers.get('if-none-match');
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }

    // Select sample image for layouts that accept one.
    let bgImageUrl: string | null = null;
    if (layout.supportsImage) {
      bgImageUrl = await pickSampleImage(supabase, brand.id);
      if (!bgImageUrl) {
        bgImageUrl = `https://picsum.photos/seed/${encodeURIComponent(brand.id)}-${encodeURIComponent(layoutId)}/1080/1920`;
      }
    }

    // Build a mock idea whose copy matches the layout's best_for.
    const mockIdea = {
      id:                      '00000000-0000-0000-0000-000000000000',
      brand_id:                brand.id,
      week_id:                 '00000000-0000-0000-0000-000000000000',
      position:                0,
      format:                  'story',
      angle:                   layout.best_for[0] ?? 'custom',
      hook:                    null,
      image_generation_prompt: null,
      copy_draft:              demoCopyFor(layout),
      hashtags:                null,
      suggested_asset_url:     null,
      suggested_asset_id:      null,
      category_id:             null,
      agent_output_id:         null,
      status:                  'pending',
      content_kind:            'story',
      story_type:              layout.best_for[0] ?? 'custom',
      template_id:             null,
      rendered_image_url:      null,
      generation_fallback:     false,
    } as unknown as ContentIdea;

    const buffer = await withTimeout(
      renderStory({ layoutName: layoutId, idea: mockIdea, brand, bgImageUrl: bgImageUrl ?? undefined }),
      RENDER_TIMEOUT_MS,
      `renderStory(${layoutId})`,
    );

    return new Response(Buffer.from(buffer), {
      status: 200,
      headers: {
        'Content-Type':  'image/png',
        'Cache-Control': 'public, max-age=300, s-maxage=600',
        ETag:            etag,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    if (msg.includes('timeout')) {
      console.error('[GET /api/brand/preview-layout]', err);
      return NextResponse.json({ error: 'render timeout' }, { status: 504 });
    }
    return apiError(err, 'GET /api/brand/preview-layout');
  }
}
