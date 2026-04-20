import { NextResponse }                         from 'next/server';
import { requireServerUser, createAdminClient } from '@/lib/supabase';
import { apiError }                             from '@/lib/api-utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

/** PATCH /api/client/brand-material/[id] */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user   = await requireServerUser();
    const db     = createAdminClient() as DB;
    const body   = await req.json() as Record<string, unknown>;

    const { data: brand } = await db
      .from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const allowed = ['content', 'valid_until', 'display_order', 'active'] as const;
    const patch: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) patch[key] = body[key];
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
    }

    const { data: updated, error } = await db
      .from('brand_material')
      .update(patch)
      .eq('id', id)
      .eq('brand_id', brand.id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ item: updated });
  } catch (err) {
    return apiError(err, 'PATCH /api/client/brand-material/[id]');
  }
}

/** DELETE /api/client/brand-material/[id] */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user   = await requireServerUser();
    const db     = createAdminClient() as DB;

    const { data: brand } = await db
      .from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { error } = await db
      .from('brand_material')
      .delete()
      .eq('id', id)
      .eq('brand_id', brand.id);

    if (error) throw error;
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return apiError(err, 'DELETE /api/client/brand-material/[id]');
  }
}
