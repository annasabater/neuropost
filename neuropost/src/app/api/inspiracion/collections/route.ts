// =============================================================================
// /api/inspiracion/collections — private collections for the active brand
// =============================================================================

import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { apiError } from '@/lib/api-utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

async function resolveBrandId(db: DB, userId: string): Promise<string | null> {
  const { data } = await db.from('brands').select('id').eq('user_id', userId).maybeSingle();
  return (data?.id as string) ?? null;
}

// ─── GET — list collections + item counts ──────────────────────────────────

export async function GET() {
  try {
    const user = await requireServerUser();
    const db   = (await createServerClient()) as DB;
    const brandId = await resolveBrandId(db, user.id);
    if (!brandId) return NextResponse.json({ collections: [] });

    const { data: cols, error } = await db
      .from('inspiration_collections')
      .select('id, name, description, cover_url, created_at, updated_at')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: true });
    if (error) throw error;

    const ids = (cols ?? []).map((c: { id: string }) => c.id);
    let counts: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: saved } = await db
        .from('inspiration_saved')
        .select('collection_id')
        .eq('brand_id', brandId)
        .in('collection_id', ids);
      counts = (saved ?? []).reduce((acc: Record<string, number>, row: { collection_id: string | null }) => {
        if (row.collection_id) acc[row.collection_id] = (acc[row.collection_id] ?? 0) + 1;
        return acc;
      }, {});
    }

    // Also compute "uncategorised" count (saved rows with collection_id = null)
    const { count: unfiledCount } = await db
      .from('inspiration_saved')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brandId)
      .is('collection_id', null);

    // And total saved
    const { count: totalCount } = await db
      .from('inspiration_saved')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brandId);

    return NextResponse.json({
      collections: (cols ?? []).map((c: { id: string }) => ({ ...c, item_count: counts[c.id] ?? 0 })),
      unfiled_count: unfiledCount ?? 0,
      total_count:   totalCount   ?? 0,
    });
  } catch (err) {
    return apiError(err, 'GET /api/inspiracion/collections');
  }
}

// ─── POST — create ────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const user = await requireServerUser();
    const db   = (await createServerClient()) as DB;
    const brandId = await resolveBrandId(db, user.id);
    if (!brandId) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const body = await request.json() as { name?: string; description?: string; cover_url?: string };
    const name = (body.name ?? '').trim();
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
    if (name.length > 80) return NextResponse.json({ error: 'name too long' }, { status: 400 });

    const { data, error } = await db
      .from('inspiration_collections')
      .insert({
        brand_id:    brandId,
        name,
        description: body.description ?? null,
        cover_url:   body.cover_url   ?? null,
      })
      .select()
      .single();
    if (error) {
      // Unique constraint violation on (brand_id, name)
      if (error.code === '23505') return NextResponse.json({ error: 'Ya existe una colección con ese nombre' }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ collection: { ...data, item_count: 0 } });
  } catch (err) {
    return apiError(err, 'POST /api/inspiracion/collections');
  }
}

// ─── PATCH — rename / change cover ────────────────────────────────────────

export async function PATCH(request: Request) {
  try {
    const user = await requireServerUser();
    const db   = (await createServerClient()) as DB;
    const brandId = await resolveBrandId(db, user.id);
    if (!brandId) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const body = await request.json() as { id?: string; name?: string; description?: string; cover_url?: string | null };
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.name === 'string')        patch.name        = body.name.trim();
    if (typeof body.description === 'string') patch.description = body.description;
    if ('cover_url' in body)                  patch.cover_url   = body.cover_url;

    const { data, error } = await db
      .from('inspiration_collections')
      .update(patch)
      .eq('id', body.id)
      .eq('brand_id', brandId)
      .select()
      .single();
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Ya existe una colección con ese nombre' }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ collection: data });
  } catch (err) {
    return apiError(err, 'PATCH /api/inspiracion/collections');
  }
}

// ─── DELETE — remove collection (saved rows get collection_id=NULL) ───────

export async function DELETE(request: Request) {
  try {
    const user = await requireServerUser();
    const db   = (await createServerClient()) as DB;
    const brandId = await resolveBrandId(db, user.id);
    if (!brandId) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { error } = await db
      .from('inspiration_collections')
      .delete()
      .eq('id', id)
      .eq('brand_id', brandId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, 'DELETE /api/inspiracion/collections');
  }
}
