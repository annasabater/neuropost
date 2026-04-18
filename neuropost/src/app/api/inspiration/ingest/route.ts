// =============================================================================
// NEUROPOST — Inspiration queue cron runner
// Called every minute by Vercel Cron. Picks pending jobs older than 10s (so all
// members of a Telegram media_group have arrived), groups them by
// media_group_id, and processes each group in parallel.
// =============================================================================

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { processJobGroup } from '@/lib/inspiration/processor';
import type { QueueJob } from '@/lib/inspiration/types';

export const runtime     = 'nodejs';
export const maxDuration = 300;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

const MAX_GROUPS   = 3;       // run up to 3 groups per tick
const DEFER_SECONDS = 10;     // wait this long before treating a group as complete

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const got = request.headers.get('authorization');
  if (!cronSecret || got !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient() as DB;

  const cutoff = new Date(Date.now() - DEFER_SECONDS * 1000).toISOString();

  const { data: rawJobs, error } = await supabase
    .from('inspiration_queue')
    .select('*')
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(MAX_GROUPS * 10);  // enough rows to form 3 carousels of up to 10 each

  if (error) {
    console.error('[inspiration] picker failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!rawJobs || rawJobs.length === 0) {
    return NextResponse.json({ picked: 0, results: [] });
  }

  // Group by media_group_id (null → each job is its own group, keyed by id)
  const groups = new Map<string, QueueJob[]>();
  for (const j of rawJobs as QueueJob[]) {
    const key = j.media_group_id ?? `__single__${j.id}`;
    const arr = groups.get(key) ?? [];
    arr.push(j);
    groups.set(key, arr);
  }

  // Take only the first MAX_GROUPS groups (in insertion order, which is created_at asc)
  const selected = Array.from(groups.values()).slice(0, MAX_GROUPS);

  const results = await Promise.allSettled(selected.map(g => processJobGroup(g)));

  const summary = results.map((r, i) => ({
    jobIds: selected[i].map(j => j.id),
    status: r.status,
    error:  r.status === 'rejected' ? String(r.reason) : undefined,
  }));

  return NextResponse.json({ picked: selected.length, results: summary });
}
