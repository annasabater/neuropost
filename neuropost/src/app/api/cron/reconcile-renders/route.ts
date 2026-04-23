// =============================================================================
// Cron: reconcile-renders — re-trigger stuck / failed story renders
// =============================================================================
// Runs every 2 minutes. Picks stories in one of three states:
//   - pending_render (never dispatched or stuck without started_at)
//   - rendering with render_started_at > 5 min (presumed dead)
//   - render_failed with render_attempts < 3 (retriable)
//
// Fires fire-and-forget POST to /api/render/story/[id] for each candidate.
// The render endpoint owns its own atomic claim (render_status pending→rendering),
// so two simultaneous cron runs are safe — the second fetch gets 409.
//
// Cap: 3 reconciler attempts per idea (render_attempts). After that, the idea is
// permanently marked render_failed with render_error='max_attempts_exceeded'.

import { NextResponse }      from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { log }               from '@/lib/logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export const dynamic     = 'force-dynamic';
export const maxDuration = 30;

const MAX_ATTEMPTS   = 3;
const STUCK_AFTER_MS = 5 * 60 * 1000; // 5 minutes
const PICK_LIMIT     = 20;

export async function GET(request: Request) {
  const auth         = request.headers.get('authorization');
  const isVercel     = request.headers.get('x-vercel-cron') === '1';
  const secret       = process.env.CRON_SECRET ?? '';
  const validBearer  = secret && auth === `Bearer ${secret}`;
  if (!isVercel && !validBearer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const renderToken = process.env.INTERNAL_RENDER_TOKEN;
  if (!renderToken) {
    log({ level: 'error', scope: 'cron/reconcile-renders', event: 'missing_render_token' });
    return NextResponse.json({ ok: false, error: 'INTERNAL_RENDER_TOKEN not configured' }, { status: 500 });
  }

  const t0 = Date.now();
  const db = createAdminClient() as DB;

  // ─── 1. Reset stuck 'rendering' (presumed dead) ──────────────────────────────
  const stuckAt = new Date(Date.now() - STUCK_AFTER_MS).toISOString();
  const { data: resetRows } = await db
    .from('content_ideas')
    .update({ render_status: 'pending_render', render_started_at: null })
    .eq('content_kind', 'story')
    .eq('render_status', 'rendering')
    .lt('render_started_at', stuckAt)
    .select('id');

  if (resetRows?.length) {
    log({ level: 'warn', scope: 'cron/reconcile-renders', event: 'stuck_rendering_reset',
          count: resetRows.length });
  }

  // ─── 2. Query eligible candidates ────────────────────────────────────────────
  // Two groups fetched separately to avoid complex PostgREST filter syntax:
  const [{ data: pendingRows }, { data: failedRows }] = await Promise.all([
    db.from('content_ideas')
      .select('id, render_attempts, render_status')
      .eq('content_kind', 'story')
      .eq('render_status', 'pending_render')
      .order('created_at', { ascending: true })
      .limit(PICK_LIMIT),
    db.from('content_ideas')
      .select('id, render_attempts, render_status')
      .eq('content_kind', 'story')
      .eq('render_status', 'render_failed')
      .lt('render_attempts', MAX_ATTEMPTS)
      .order('created_at', { ascending: true })
      .limit(PICK_LIMIT),
  ]);

  const candidates: { id: string; render_attempts: number; render_status: string }[] = [
    ...(pendingRows ?? []),
    ...(failedRows  ?? []),
  ].slice(0, PICK_LIMIT);

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, picked: 0, duration_ms: Date.now() - t0 });
  }

  // ─── 3. Process each candidate ───────────────────────────────────────────────
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  let retriggered      = 0;
  let permanentlyFailed = 0;

  for (const idea of candidates) {
    const nextAttempts = idea.render_attempts + 1;

    // Permanently fail ideas that have exhausted attempts
    if (nextAttempts > MAX_ATTEMPTS) {
      await db.from('content_ideas')
        .update({ render_status: 'render_failed', render_error: 'max_attempts_exceeded' })
        .eq('id', idea.id);
      log({ level: 'warn', scope: 'cron/reconcile-renders', event: 'idea_permanently_failed',
            idea_id: idea.id, attempts: idea.render_attempts });
      permanentlyFailed++;
      continue;
    }

    // Increment attempt counter before dispatching (optimistic — render endpoint owns the status claim)
    await db.from('content_ideas')
      .update({ render_attempts: nextAttempts })
      .eq('id', idea.id)
      .in('render_status', ['pending_render', 'render_failed']);

    // Fire-and-forget — do NOT await the render response
    fetch(`${baseUrl}/api/render/story/${idea.id}`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${renderToken}`,
      },
    }).catch(e => {
      log({ level: 'warn', scope: 'cron/reconcile-renders', event: 'render_dispatch_failed',
            idea_id: idea.id, error: String(e) });
    });

    log({ level: 'info', scope: 'cron/reconcile-renders', event: 'idea_retriggered',
          idea_id: idea.id, attempts: nextAttempts, previous_status: idea.render_status });
    retriggered++;
  }

  const result = {
    ok:                  true,
    picked:              candidates.length,
    retriggered,
    permanently_failed:  permanentlyFailed,
    stuck_reset:         resetRows?.length ?? 0,
    duration_ms:         Date.now() - t0,
  };

  log({ level: 'info', scope: 'cron/reconcile-renders', event: 'run_complete', ...result });
  return NextResponse.json(result);
}
