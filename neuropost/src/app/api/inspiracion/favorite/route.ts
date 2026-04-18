// =============================================================================
// /api/inspiracion/favorite — toggle favorites in the unified model
// Works for both legacy (inspiration_references) and bank (inspiration_bank)
// items. Also mirrors to inspiration_references.is_favorite for legacy rows
// so any code path still reading that column stays in sync.
// =============================================================================

import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { apiError } from '@/lib/api-utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

type Source = 'legacy' | 'bank';

async function resolveBrandId(db: DB, userId: string): Promise<string | null> {
  const { data } = await db.from('brands').select('id').eq('user_id', userId).maybeSingle();
  return (data?.id as string) ?? null;
}

function parseBody(body: { source?: string; item_id?: string }): { source: Source; itemId: string } | null {
  const source = body.source === 'bank' || body.source === 'legacy' ? body.source : null;
  const itemId = typeof body.item_id === 'string' ? body.item_id : null;
  if (!source || !itemId) return null;
  return { source, itemId };
}

// POST — add to favorites (idempotent)
export async function POST(request: Request) {
  try {
    const user = await requireServerUser();
    const db   = (await createServerClient()) as DB;
    const brandId = await resolveBrandId(db, user.id);
    if (!brandId) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const parsed = parseBody(await request.json());
    if (!parsed) return NextResponse.json({ error: 'source + item_id required' }, { status: 400 });

    const { error } = await db
      .from('inspiration_favorites')
      .upsert(
        { brand_id: brandId, source: parsed.source, item_id: parsed.itemId },
        { onConflict: 'brand_id,source,item_id' },
      );
    if (error) throw error;

    // Mirror to legacy boolean for back-compat
    if (parsed.source === 'legacy') {
      await db.from('inspiration_references')
        .update({ is_favorite: true })
        .eq('id', parsed.itemId)
        .eq('brand_id', brandId);
    }

    return NextResponse.json({ ok: true, is_favorite: true });
  } catch (err) {
    return apiError(err, 'POST /api/inspiracion/favorite');
  }
}

// DELETE — remove from favorites
export async function DELETE(request: Request) {
  try {
    const user = await requireServerUser();
    const db   = (await createServerClient()) as DB;
    const brandId = await resolveBrandId(db, user.id);
    if (!brandId) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const parsed = parseBody(await request.json());
    if (!parsed) return NextResponse.json({ error: 'source + item_id required' }, { status: 400 });

    const { error } = await db
      .from('inspiration_favorites')
      .delete()
      .eq('brand_id', brandId)
      .eq('source', parsed.source)
      .eq('item_id', parsed.itemId);
    if (error) throw error;

    if (parsed.source === 'legacy') {
      await db.from('inspiration_references')
        .update({ is_favorite: false })
        .eq('id', parsed.itemId)
        .eq('brand_id', brandId);
    }

    return NextResponse.json({ ok: true, is_favorite: false });
  } catch (err) {
    return apiError(err, 'DELETE /api/inspiracion/favorite');
  }
}
