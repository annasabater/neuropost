import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

// PATCH /api/inspiracion/referencias/[id]
// Updates mutable fields: is_favorite, notes, title
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user   = await requireServerUser();
    const db: DB = createAdminClient();

    const { data: brand } = await db
      .from('brands')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const body = await req.json() as Record<string, unknown>;
    const allowed: Record<string, unknown> = {};
    if (typeof body.is_favorite === 'boolean') allowed.is_favorite = body.is_favorite;
    if (typeof body.notes      === 'string')  allowed.notes       = body.notes;
    if (typeof body.title      === 'string')  allowed.title       = body.title;
    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await db
      .from('inspiration_references')
      .update(allowed)
      .eq('id', id)
      .eq('brand_id', brand.id)
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ reference: data });
  } catch (err) {
    return apiError(err, 'inspiracion/referencias/[id] PATCH');
  }
}

// DELETE /api/inspiracion/referencias/[id]
// Deletes a reference, verifying it belongs to the user's brand first.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user   = await requireServerUser();
    const db: DB = createAdminClient();

    const { data: brand } = await db
      .from('brands')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    // Verify ownership before deleting
    const { data: existing, error: fetchError } = await db
      .from('inspiration_references')
      .select('id')
      .eq('id', id)
      .eq('brand_id', brand.id)
      .single();
    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Reference not found' }, { status: 404 });
    }

    // Delete any linked recreation_requests first (FK constraint)
    await db
      .from('recreation_requests')
      .delete()
      .eq('reference_id', id)
      .eq('brand_id', brand.id);

    const { error } = await db
      .from('inspiration_references')
      .delete()
      .eq('id', id)
      .eq('brand_id', brand.id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, 'inspiracion/referencias/[id]');
  }
}
