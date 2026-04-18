// =============================================================================
// POST /api/inspiracion/recrear/[id]/use-version
// Body: { version: number }
//
// Sets generated_images = generation_history[version-1].images without
// mutating the history. Lets the client revert between generations.
// =============================================================================

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

interface HistoryEntry {
  prediction_id: string;
  images: string[];
  generated_at: string;
  version: number;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireServerUser();
    const { id } = await params;
    const { version } = await request.json() as { version?: number };

    if (!Number.isInteger(version) || (version as number) < 1) {
      return NextResponse.json({ error: 'Invalid version' }, { status: 400 });
    }

    const db: DB = createAdminClient();

    const { data: brand } = await db
      .from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { data: rec, error: fetchError } = await db
      .from('recreation_requests')
      .select('id, brand_id, generation_history')
      .eq('id', id)
      .eq('brand_id', brand.id)
      .single();
    if (fetchError || !rec) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const history: HistoryEntry[] = Array.isArray(rec.generation_history) ? rec.generation_history : [];
    const entry = history.find(h => h.version === version);
    if (!entry) return NextResponse.json({ error: 'Version not found' }, { status: 404 });

    await db.from('recreation_requests')
      .update({ generated_images: entry.images })
      .eq('id', id);

    return NextResponse.json({ ok: true, version, images: entry.images });
  } catch (err) {
    console.error('[POST /api/inspiracion/recrear/[id]/use-version]', err);
    return apiError(err, 'inspiracion/recrear/[id]/use-version');
  }
}
