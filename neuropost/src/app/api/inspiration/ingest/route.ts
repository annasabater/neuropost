// =============================================================================
// NEUROPOST — Inspiration queue cron runner
// Called every minute by Vercel Cron. Picks up to 3 pending jobs and processes
// them in parallel (Promise.allSettled so one failure doesn't stop the others).
// =============================================================================

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { processJob } from '@/lib/inspiration/processor';
import type { QueueJob } from '@/lib/inspiration/types';

export const runtime     = 'nodejs';
export const maxDuration = 300;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

const BATCH_SIZE = 3;

export async function GET(request: Request) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  const got = request.headers.get('authorization');
  if (!cronSecret || got !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient() as DB;

  // ── Pick pending jobs ──────────────────────────────────────────────────────
  const { data: jobs, error } = await supabase
    .from('inspiration_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error('[inspiration] picker failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ picked: 0, results: [] });
  }

  // Mark the whole batch as processing atomically enough for our traffic
  const jobIds = (jobs as QueueJob[]).map(j => j.id);
  await supabase
    .from('inspiration_queue')
    .update({ status: 'processing' })
    .in('id', jobIds);

  // ── Process in parallel ────────────────────────────────────────────────────
  const results = await Promise.allSettled(
    (jobs as QueueJob[]).map(j => processJob(j)),
  );

  const summary = results.map((r, i) => ({
    id:     (jobs as QueueJob[])[i].id,
    status: r.status,
    error:  r.status === 'rejected' ? String(r.reason) : undefined,
  }));

  return NextResponse.json({ picked: jobs.length, results: summary });
}
