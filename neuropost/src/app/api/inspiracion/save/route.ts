// =============================================================================
// /api/inspiracion/save — add/remove an item to inspiration_saved (optionally
// scoped to a collection). Works for both legacy and bank items.
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

// ─── GET — returns which collections (if any) already contain this item ───

export async function GET(request: Request) {
  try {
    const user = await requireServerUser();
    const db   = (await createServerClient()) as DB;
    const brandId = await resolveBrandId(db, user.id);
    if (!brandId) return NextResponse.json({ is_saved: false, collection_ids: [] });

    const url = new URL(request.url);
    const source = url.searchParams.get('source');
    const itemId = url.searchParams.get('item_id');
    if ((source !== 'legacy' && source !== 'bank') || !itemId) {
      return NextResponse.json({ error: 'source + item_id required' }, { status: 400 });
    }

    const { data } = await db
      .from('inspiration_saved')
      .select('collection_id')
      .eq('brand_id', brandId)
      .eq('source', source)
      .eq('item_id', itemId);

    const rows = (data ?? []) as { collection_id: string | null }[];
    return NextResponse.json({
      is_saved:        rows.length > 0,
      collection_ids:  rows.filter(r => r.collection_id !== null).map(r => r.collection_id as string),
      has_unfiled:     rows.some(r => r.collection_id === null),
    });
  } catch (err) {
    return apiError(err, 'GET /api/inspiracion/save');
  }
}

// ─── POST — upsert a saved row (idempotent per (brand, source, item, coll)) ─

export async function POST(request: Request) {
  try {
    const user = await requireServerUser();
    const db   = (await createServerClient()) as DB;
    const brandId = await resolveBrandId(db, user.id);
    if (!brandId) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const body = await request.json() as {
      source?:        string;
      item_id?:       string;
      collection_id?: string | null;
      notes?:         string | null;
    };
    if ((body.source !== 'legacy' && body.source !== 'bank') || !body.item_id) {
      return NextResponse.json({ error: 'source + item_id required' }, { status: 400 });
    }
    const source: Source        = body.source;
    const collectionId: string | null = body.collection_id ?? null;

    // If a collection_id was provided, verify it belongs to this brand.
    if (collectionId) {
      const { data: col } = await db
        .from('inspiration_collections')
        .select('id').eq('id', collectionId).eq('brand_id', brandId).maybeSingle();
      if (!col) return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    // Check if a row already exists (manual — the partial unique index is on
    // coalesce(collection_id, uuid-zero) which is tricky to express via upsert).
    const query = db
      .from('inspiration_saved')
      .select('id')
      .eq('brand_id', brandId)
      .eq('source', source)
      .eq('item_id', body.item_id);
    if (collectionId) query.eq('collection_id', collectionId);
    else              query.is('collection_id', null);

    const { data: existing } = await query.maybeSingle();
    if (existing) {
      if (typeof body.notes === 'string') {
        await db.from('inspiration_saved').update({ notes: body.notes }).eq('id', existing.id);
      }
      return NextResponse.json({ ok: true, id: existing.id, created: false });
    }

    const { data, error } = await db
      .from('inspiration_saved')
      .insert({
        brand_id:      brandId,
        source,
        item_id:       body.item_id,
        collection_id: collectionId,
        notes:         body.notes ?? null,
      })
      .select('id')
      .single();
    if (error) throw error;

    // Mirror to legacy is_saved for back-compat
    if (source === 'legacy') {
      await db.from('inspiration_references')
        .update({ is_saved: true })
        .eq('id', body.item_id)
        .eq('brand_id', brandId);
    }

    return NextResponse.json({ ok: true, id: data.id, created: true });
  } catch (err) {
    return apiError(err, 'POST /api/inspiracion/save');
  }
}

// ─── DELETE — remove from a specific collection, or all collections ───────

export async function DELETE(request: Request) {
  try {
    const user = await requireServerUser();
    const db   = (await createServerClient()) as DB;
    const brandId = await resolveBrandId(db, user.id);
    if (!brandId) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const body = await request.json() as {
      source?:        string;
      item_id?:       string;
      collection_id?: string | null;
      /** When true, removes the item from every collection + unfiled. */
      all?:           boolean;
    };
    if ((body.source !== 'legacy' && body.source !== 'bank') || !body.item_id) {
      return NextResponse.json({ error: 'source + item_id required' }, { status: 400 });
    }

    const source: Source = body.source;
    let q = db.from('inspiration_saved').delete()
      .eq('brand_id', brandId).eq('source', source).eq('item_id', body.item_id);

    if (!body.all) {
      if (body.collection_id)  q = q.eq('collection_id', body.collection_id);
      else                     q = q.is('collection_id', null);
    }

    const { error } = await q;
    if (error) throw error;

    // If fully removed, drop the legacy mirror too
    if (body.all && source === 'legacy') {
      await db.from('inspiration_references')
        .update({ is_saved: false })
        .eq('id', body.item_id)
        .eq('brand_id', brandId);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, 'DELETE /api/inspiracion/save');
  }
}
