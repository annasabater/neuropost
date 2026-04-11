import { NextResponse } from 'next/server';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

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
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
