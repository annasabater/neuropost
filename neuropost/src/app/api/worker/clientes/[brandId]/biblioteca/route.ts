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

    const [brandRes, mediaRes] = await Promise.all([
      db.from('brands').select('id, name, sector').eq('id', brandId).single(),
      db
        .from('media_library')
        .select('id, brand_id, storage_path, url, type, mime_type, size_bytes, duration, width, height, created_at')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false }),
    ]);

    if (brandRes.error || !brandRes.data) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      brand: brandRes.data,
      media: mediaRes.data ?? [],
    });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
