import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ brandId: string }> },
) {
  try {
    await requireWorker();
    const { brandId } = await ctx.params;
    const db = createAdminClient();

    const [brandRes, refsRes, recreationsRes] = await Promise.all([
      db.from('brands').select('id, name, sector').eq('id', brandId).single(),
      db
        .from('inspiration_references')
        .select('id, brand_id, type, source_url, thumbnail_url, title, notes, sector, style_tags, format, is_saved, created_at')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false }),
      db
        .from('recreation_requests')
        .select('id, brand_id, reference_id, client_notes, style_to_adapt, status, worker_notes, created_at')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false }),
    ]);

    if (brandRes.error || !brandRes.data) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      brand: brandRes.data,
      references: refsRes.data ?? [],
      recreations: recreationsRes.data ?? [],
    });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
