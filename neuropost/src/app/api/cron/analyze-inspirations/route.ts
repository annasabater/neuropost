// =============================================================================
// Cron: analyze-inspirations
// =============================================================================
// Runs hourly. Finds inspiration_references with analysis_status = 'pending'
// (i.e. they have a thumbnail_url but haven't been analyzed yet) and queues
// content:analyze_inspiration for each one.
//
// This covers:
//   - References saved before the auto-analysis feature was deployed
//   - References where the initial queue failed (Redis down, etc.)
//   - References added programmatically without triggering the POST endpoint

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { queueJob } from '@/lib/agents/queue';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export const dynamic    = 'force-dynamic';
export const maxDuration = 30;

const BATCH = 20; // max references to process per run

export async function GET(request: Request) {
  const auth      = request.headers.get('authorization');
  const isVercel  = request.headers.get('x-vercel-cron') === '1';
  const secret    = process.env.CRON_SECRET ?? '';
  const validBearer = secret && auth === `Bearer ${secret}`;
  if (!isVercel && !validBearer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createAdminClient() as DB;

  // Load pending references that have an image URL
  const { data: refs, error } = await db
    .from('inspiration_references')
    .select('id, brand_id, thumbnail_url, notes, title, sector')
    .eq('analysis_status', 'pending')
    .not('thumbnail_url', 'is', null)
    .order('created_at', { ascending: true })
    .limit(BATCH);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const pending = (refs ?? []) as Array<{
    id: string;
    brand_id: string;
    thumbnail_url: string;
    notes: string | null;
    title: string | null;
    sector: string | null;
  }>;

  if (!pending.length) {
    return NextResponse.json({ ok: true, queued: 0, message: 'No pending references' });
  }

  // Load brand context for each unique brand_id
  const brandIds = [...new Set(pending.map((r) => r.brand_id))];
  const { data: brands } = await db
    .from('brands')
    .select('id, name, sector, visual_style')
    .in('id', brandIds);

  const brandMap = new Map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (brands ?? []).map((b: any) => [b.id, b]),
  );

  let queued = 0;
  for (const ref of pending) {
    const brand = brandMap.get(ref.brand_id) as {
      name: string; sector?: string; visual_style?: string;
    } | undefined;

    // Mark as 'analyzing' to prevent duplicate processing
    await db
      .from('inspiration_references')
      .update({ analysis_status: 'analyzing' })
      .eq('id', ref.id)
      .eq('analysis_status', 'pending'); // optimistic lock

    await queueJob({
      brand_id:     ref.brand_id,
      agent_type:   'content',
      action:       'analyze_inspiration',
      input: {
        referenceImageUrl: ref.thumbnail_url,
        clientNotes:       ref.notes      ?? '',
        brandContext:      brand
          ? `${brand.name} — sector ${brand.sector ?? 'otro'}, estilo ${brand.visual_style ?? 'natural'}`
          : `Sector ${ref.sector ?? 'negocio local'}`,
        sector:            brand?.sector ?? ref.sector ?? 'otro',
        visualStyle:       brand?.visual_style ?? undefined,
        _reference_id:     ref.id,
      },
      priority:     40, // low priority — background task
      requested_by: 'cron',
    }).catch(async () => {
      // Queue failed → revert to pending so next cron run retries
      await db
        .from('inspiration_references')
        .update({ analysis_status: 'pending' })
        .eq('id', ref.id);
    });

    queued++;
  }

  console.log(`[analyze-inspirations] Queued ${queued} references for analysis`);
  return NextResponse.json({ ok: true, queued });
}
