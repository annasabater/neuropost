import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { getRemainingQuota } from '@/lib/regeneration';

/**
 * GET /api/quota
 *
 * Returns the authenticated user's remaining weekly content quota.
 * Used by the client dashboard to show the quota bar.
 */
export async function GET() {
  try {
    const user     = await requireServerUser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createServerClient() as any;

    const { data: brand } = await supabase
      .from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const quota = await getRemainingQuota(brand.id);
    return NextResponse.json({
      ...quota,
      weekStart: quota.weekStart.toISOString(),
    });
  } catch (err) {
    return apiError(err, 'quota');
  }
}
