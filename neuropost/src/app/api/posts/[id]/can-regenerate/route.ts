import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { canRegenerate } from '@/lib/regeneration';

/**
 * GET /api/posts/[id]/can-regenerate
 *
 * Returns whether the authenticated user can regenerate the given post,
 * and whether it will cost 1 post from their weekly quota.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id }   = await params;
    const user     = await requireServerUser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createServerClient() as any;

    const { data: brand } = await supabase
      .from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const result = await canRegenerate(id, brand.id);
    return NextResponse.json(result);
  } catch (err) {
    return apiError(err, 'posts/[id]/can-regenerate');
  }
}
