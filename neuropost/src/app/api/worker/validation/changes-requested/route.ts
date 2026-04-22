import { NextResponse }                          from 'next/server';
import { createAdminClient }                     from '@/lib/supabase';
import { requireWorker, workerErrorResponse }    from '@/lib/worker';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

interface PendingRow {
  id:                   string;
  week_id:              string;
  brand_id:             string;
  angle:                string;
  copy_draft:           string | null;
  hook:                 string | null;
  hashtags:             string[] | null;
  format:               string;
  content_kind:         string;
  original_idea_id:     string | null;
  regeneration_reason:  string | null;
  created_at:           string;
}

export async function GET() {
  try {
    const worker = await requireWorker();
    const db     = createAdminClient() as DB;

    // 1. Variations waiting for the worker. The partial index makes
    //    this query cheap even on large content_ideas tables.
    let q = db
      .from('content_ideas')
      .select(`
        id, week_id, brand_id, angle, copy_draft, hook, hashtags,
        format, content_kind, original_idea_id, regeneration_reason,
        created_at
      `)
      .eq('awaiting_worker_review', true)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(100);
    if (worker.role === 'worker' && worker.brands_assigned?.length) {
      q = q.in('brand_id', worker.brands_assigned);
    }
    const { data: pending, error } = await q;
    if (error) throw error;

    const rows = (pending ?? []) as PendingRow[];
    if (rows.length === 0) return NextResponse.json({ items: [] });

    // 2. Fetch the originals (linked via original_idea_id) in bulk.
    const originalIds = rows
      .map((r) => r.original_idea_id)
      .filter((v): v is string => typeof v === 'string');
    const origRes = originalIds.length
      ? await db.from('content_ideas')
          .select('id, angle, copy_draft, hook, format')
          .in('id', originalIds)
      : { data: [] as Array<{ id: string }> };
    const origById = new Map(
      ((origRes.data ?? []) as Array<{ id: string }>).map((o) => [o.id, o]),
    );

    // 3. Brand names in bulk.
    const brandIds = Array.from(new Set(rows.map((r) => r.brand_id)));
    const { data: brands } = await db
      .from('brands').select('id, name').in('id', brandIds);
    const brandById = new Map(
      ((brands ?? []) as Array<{ id: string; name: string }>).map((b) => [b.id, b.name]),
    );

    const items = rows.map((r) => ({
      new_idea: {
        id:         r.id,
        angle:      r.angle,
        copy_draft: r.copy_draft,
        hook:       r.hook,
        hashtags:   r.hashtags,
        format:     r.format,
      },
      original_idea: r.original_idea_id ? origById.get(r.original_idea_id) ?? null : null,
      brand_id:      r.brand_id,
      brand_name:    brandById.get(r.brand_id) ?? null,
      week_id:       r.week_id,
      comment:       r.regeneration_reason,
      created_at:    r.created_at,
    }));

    return NextResponse.json({ items });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
