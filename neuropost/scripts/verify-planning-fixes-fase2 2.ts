/* eslint-disable no-console */
// =============================================================================
// verify-planning-fixes-fase2.ts
// =============================================================================
// Integration tests for Phase 2 reconciliation crons.
// Requires dev server running at NEXT_PUBLIC_SITE_URL (or http://localhost:3000)
// AND real Supabase connection (service_role).
//
// Run: npx tsx --tsconfig tsconfig.json scripts/verify-planning-fixes-fase2.ts
//
// Each test case creates its own plan (avoids position-constraint collisions).
// All test plans are marked with skip_reason='__test_fase2' for idempotent
// pre-run cleanup. Cleanup is guaranteed in try/finally even on failure.
// =============================================================================

import { readFileSync, existsSync } from 'node:fs';
import { resolve }                  from 'node:path';
import { createClient }             from '@supabase/supabase-js';

// ─── env ─────────────────────────────────────────────────────────────────────

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const eq = line.indexOf('='); if (eq === -1) continue;
    const k = line.slice(0, eq).trim(); let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CRON_SECRET  = process.env.CRON_SECRET!;
const BASE_URL     = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}
if (!CRON_SECRET) {
  console.error('ERROR: CRON_SECRET required');
  process.exit(1);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = createClient(SUPABASE_URL, SERVICE_KEY) as any;

// ─── result counters ─────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function pass(name: string) { console.log(`  ✓ ${name}`); passed++; }
function fail(name: string, detail: string) { console.error(`  ✗ ${name}: ${detail}`); failed++; }

async function check(name: string, fn: () => Promise<void>) {
  try { await fn(); pass(name); }
  catch (e) { fail(name, e instanceof Error ? e.message : String(e)); }
}

// ─── cleanup registry ─────────────────────────────────────────────────────────
// Only plans are tracked — ON DELETE CASCADE handles content_ideas + client_feedback.

const createdPlanIds: string[] = [];

function registerForCleanup(planId: string) {
  createdPlanIds.push(planId);
}

async function cleanupRegistered() {
  for (const id of createdPlanIds) {
    try { await db.from('weekly_plans').delete().eq('id', id); } catch { /* best-effort */ }
  }
}

// ─── pre-run sweep ────────────────────────────────────────────────────────────
// Removes any orphaned test plans from prior failed runs.

const TEST_MARKER = '__test_fase2';

async function sweepOldTestData() {
  const { error } = await db
    .from('weekly_plans')
    .delete()
    .like('skip_reason', `${TEST_MARKER}%`);
  if (error) console.warn('Pre-run sweep warning:', error.message);
}

// ─── helpers ──────────────────────────────────────────────────────────────────

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function callCron(path: string): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Authorization': `Bearer ${CRON_SECRET}` },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`cron ${path} returned non-JSON (status ${res.status}): ${text.slice(0, 200)}`);
  }
  return { ok: res.ok, status: res.status, body };
}

// ─── fixture helpers ──────────────────────────────────────────────────────────

async function getTestBrand(): Promise<string> {
  const { data, error } = await db
    .from('brands').select('id').eq('use_new_planning_flow', true).limit(1).single();
  if (error || !data) throw new Error(`No brand with use_new_planning_flow=true: ${error?.message ?? 'not found'}`);
  return data.id as string;
}

// Monotonic counter ensures unique week_start even when plans are created in the same millisecond
let _planSeq = 0;
async function createTestPlan(brandId: string, overrides: Record<string, unknown> = {}): Promise<string> {
  _planSeq++;
  const seed  = Date.now() + _planSeq;
  const year  = 2090 + (seed % 9);
  const month = String(1 + (Math.floor(seed / 1000) % 12)).padStart(2, '0');
  const day   = String(1 + (_planSeq % 28)).padStart(2, '0');

  const { data, error } = await db.from('weekly_plans').insert({
    brand_id:    brandId,
    week_start:  `${year}-${month}-${day}`,
    status:      'ideas_ready',
    skip_reason: TEST_MARKER,   // ← marker for pre-run sweep
    ...overrides,
  }).select('id').single();

  if (error || !data) throw new Error(`createTestPlan: ${error?.message}`);
  registerForCleanup(data.id as string);
  return data.id as string;
}

// Each plan gets its own idea at position 0 — no cross-plan collision possible
async function createTestIdea(planId: string, brandId: string, overrides: Record<string, unknown> = {}): Promise<string> {
  const { data, error } = await db.from('content_ideas').insert({
    week_id:         planId,
    brand_id:        brandId,
    content_kind:    'story',
    format:          'story',
    angle:           `${TEST_MARKER}_idea`,
    position:        0,            // safe: unique plan per case
    render_status:   'pending_render',
    render_attempts: 0,
    ...overrides,
  }).select('id').single();

  if (error || !data) throw new Error(`createTestIdea: ${error?.message}`);
  // No explicit cleanup — plan CASCADE handles it
  return data.id as string;
}

async function backdateIdea(id: string, minutesAgo: number) {
  const ts = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
  await db.from('content_ideas').update({ created_at: ts }).eq('id', id);
}

async function backdatePlan(id: string, hoursAgo: number) {
  const ts = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
  await db.from('weekly_plans').update({ created_at: ts }).eq('id', id);
}

// ─── verifyReconcileRenders ───────────────────────────────────────────────────

async function verifyReconcileRenders(brandId: string) {
  console.log('\nreconcileRenders:');

  // ── Case 1: pending_render older than 5min → cron picks it up ────────────
  await check('picks up pending_render older than 5min', async () => {
    const planId  = await createTestPlan(brandId);
    const ideaId  = await createTestIdea(planId, brandId, { render_status: 'pending_render', render_attempts: 0 });
    await backdateIdea(ideaId, 10);

    const { ok, body, status } = await callCron('/api/cron/reconcile-renders');
    if (status === 500 && String(body.error).includes('INTERNAL_RENDER_TOKEN')) {
      throw new Error('INTERNAL_RENDER_TOKEN not set in .env.local — add it to run this check');
    }
    if (!ok) throw new Error(`cron error ${status}: ${JSON.stringify(body)}`);
    if (typeof body.picked !== 'number' || (body.picked as number) < 1) {
      throw new Error(`expected picked>=1, got ${body.picked}`);
    }
    // Give fire-and-forget a moment, then verify render_attempts incremented
    await sleep(600);
    const { data } = await db.from('content_ideas').select('render_attempts').eq('id', ideaId).single();
    if (!data || (data.render_attempts as number) < 1) {
      throw new Error(`render_attempts not incremented (got ${data?.render_attempts})`);
    }
  });

  // ── Case 2: render_failed with attempts>=3 → cron permanently fails it ──
  await check('ignores render_failed with attempts>=3', async () => {
    const planId = await createTestPlan(brandId);
    const ideaId = await createTestIdea(planId, brandId, { render_status: 'render_failed', render_attempts: 3 });
    await backdateIdea(ideaId, 10);

    const { ok, body, status } = await callCron('/api/cron/reconcile-renders');
    if (status === 500 && String(body.error).includes('INTERNAL_RENDER_TOKEN')) {
      throw new Error('INTERNAL_RENDER_TOKEN not set in .env.local');
    }
    if (!ok) throw new Error(`cron error ${status}: ${JSON.stringify(body)}`);

    const { data } = await db.from('content_ideas').select('render_status, render_error').eq('id', ideaId).single();
    if (data?.render_status !== 'render_failed') {
      throw new Error(`Expected render_failed, got ${data?.render_status}`);
    }
    if (data?.render_error !== 'max_attempts_exceeded') {
      throw new Error(`Expected render_error='max_attempts_exceeded', got '${data?.render_error}'`);
    }
  });

  // ── Case 3: stuck 'rendering' > 5min → reset + retriggered ──────────────
  await check('re-picks rendering stuck for >5min', async () => {
    const planId = await createTestPlan(brandId);
    await createTestIdea(planId, brandId, {
      render_status:     'rendering',
      render_started_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      render_attempts:   0,
    });

    const { ok, body, status } = await callCron('/api/cron/reconcile-renders');
    if (status === 500 && String(body.error).includes('INTERNAL_RENDER_TOKEN')) {
      throw new Error('INTERNAL_RENDER_TOKEN not set in .env.local');
    }
    if (!ok) throw new Error(`cron error ${status}: ${JSON.stringify(body)}`);
    if (typeof body.stuck_reset !== 'number' || (body.stuck_reset as number) < 1) {
      throw new Error(`expected stuck_reset>=1, got ${body.stuck_reset}`);
    }
  });
}

// ─── verifyReconcileEmails ────────────────────────────────────────────────────

async function verifyReconcileEmails(brandId: string) {
  console.log('\nreconcileEmails:');

  // ── Case 1: failed email, attempts<3 → cron retries it ──────────────────
  await check('retries failed email with attempts<3', async () => {
    const planId = await createTestPlan(brandId, {
      status:               'client_reviewing',
      client_email_status:  'failed',
      client_email_attempts: 1,
    });

    const { ok, body, status } = await callCron('/api/cron/reconcile-client-emails');
    if (!ok) throw new Error(`cron error ${status}: ${JSON.stringify(body)}`);
    if (typeof body.retried !== 'number' || (body.retried as number) < 1) {
      throw new Error(`expected retried>=1, got ${body.retried}`);
    }
    await sleep(600);
    const { data } = await db.from('weekly_plans')
      .select('client_email_status, client_email_attempts').eq('id', planId).single();
    if (!data) throw new Error('plan not found after retry');
    // Status must not be stuck at 'pending' — it was claimed and processed to 'sent' or 'failed'
    if (data.client_email_status === 'pending') {
      throw new Error('client_email_status stuck at pending after processing');
    }
  });

  // ── Case 2: failed email, attempts>=3 → cron ignores it ─────────────────
  await check('ignores email with attempts>=3', async () => {
    const planId = await createTestPlan(brandId, {
      status:               'client_reviewing',
      client_email_status:  'failed',
      client_email_attempts: 3,
    });

    const { ok, body, status } = await callCron('/api/cron/reconcile-client-emails');
    if (!ok) throw new Error(`cron error ${status}: ${JSON.stringify(body)}`);

    const { data } = await db.from('weekly_plans')
      .select('client_email_status, client_email_attempts').eq('id', planId).single();
    if ((data?.client_email_attempts as number) !== 3) {
      throw new Error(`Attempts changed unexpectedly: was 3, now ${data?.client_email_attempts}`);
    }
    if (data?.client_email_status !== 'failed') {
      throw new Error(`Status changed unexpectedly from failed to ${data?.client_email_status}`);
    }
  });
}

// ─── verifyDetectStuckPlans ───────────────────────────────────────────────────

async function verifyDetectStuckPlans(brandId: string) {
  console.log('\ndetectStuckPlans:');

  // ── Case 1: stuck in 'generating' > 10min → expires ─────────────────────
  await check('expires generating >10min', async () => {
    const planId = await createTestPlan(brandId, { status: 'generating' });
    await backdatePlan(planId, 1);  // 1 hour ago

    const { ok, body, status } = await callCron('/api/cron/detect-stuck-plans');
    if (!ok) throw new Error(`cron error ${status}: ${JSON.stringify(body)}`);
    if (typeof body.stuck_generating_expired !== 'number' || (body.stuck_generating_expired as number) < 1) {
      throw new Error(`expected stuck_generating_expired>=1, got ${body.stuck_generating_expired}`);
    }
    const { data } = await db.from('weekly_plans').select('status, skip_reason').eq('id', planId).single();
    if (data?.status !== 'expired') throw new Error(`Expected expired, got ${data?.status}`);
    if (data?.skip_reason !== 'stuck_in_generating_over_10_minutes') {
      throw new Error(`Wrong skip_reason: ${data?.skip_reason}`);
    }
  });

  // ── Case 2: ideas_ready + worker unnotified > 30min → alert only ─────────
  await check('alerts ideas_ready with failed notification >30min (no status change)', async () => {
    const planId = await createTestPlan(brandId, {
      status:              'ideas_ready',
      worker_notify_status: 'pending',
    });
    await backdatePlan(planId, 1);  // 1 hour ago

    const { ok, body, status } = await callCron('/api/cron/detect-stuck-plans');
    if (!ok) throw new Error(`cron error ${status}: ${JSON.stringify(body)}`);
    if (typeof body.stuck_unnotified_alerted !== 'number' || (body.stuck_unnotified_alerted as number) < 1) {
      throw new Error(`expected stuck_unnotified_alerted>=1, got ${body.stuck_unnotified_alerted}`);
    }
    const { data } = await db.from('weekly_plans').select('status').eq('id', planId).single();
    if (data?.status !== 'ideas_ready') {
      throw new Error(`Status should not have changed — got ${data?.status}`);
    }
  });

  // ── Case 3: client_reviewing abandoned > 7 days → expires ────────────────
  await check('expires abandoned plans >7d', async () => {
    const planId = await createTestPlan(brandId, { status: 'client_reviewing' });
    await backdatePlan(planId, 8 * 24);  // 8 days ago

    const { ok, body, status } = await callCron('/api/cron/detect-stuck-plans');
    if (!ok) throw new Error(`cron error ${status}: ${JSON.stringify(body)}`);
    if (typeof body.abandoned_expired !== 'number' || (body.abandoned_expired as number) < 1) {
      throw new Error(`expected abandoned_expired>=1, got ${body.abandoned_expired}`);
    }
    const { data } = await db.from('weekly_plans').select('status, skip_reason').eq('id', planId).single();
    if (data?.status !== 'expired') throw new Error(`Expected expired, got ${data?.status}`);
    if (data?.skip_reason !== 'abandoned_over_7_days') {
      throw new Error(`Wrong skip_reason: ${data?.skip_reason}`);
    }
  });
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== verify-planning-fixes-fase2 ===\n');

  // ── 1. Check dev server ─────────────────────────────────────────────────
  try {
    const ping = await fetch(`${BASE_URL}/api/cron/health-check`, {
      headers: { 'Authorization': `Bearer ${CRON_SECRET}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!ping.ok && ping.status !== 401) {
      console.warn(`⚠  Dev server at ${BASE_URL} responded ${ping.status} — tests may fail`);
    } else {
      console.log(`Dev server: ${BASE_URL} ✓`);
    }
  } catch {
    console.error(`ERROR: Dev server not reachable at ${BASE_URL}`);
    console.error('Start with: npm run dev, then re-run this script');
    process.exit(1);
  }

  // ── 2. Pre-run sweep — clean orphaned test data from previous runs ───────
  process.stdout.write('Pre-run sweep… ');
  await sweepOldTestData();
  console.log('done');

  // ── 3. Run all checks (cleanup guaranteed in finally) ───────────────────
  let brandId!: string;
  try {
    brandId = await getTestBrand();
    console.log(`Using brand: ${brandId}`);

    await verifyReconcileRenders(brandId);
    await verifyReconcileEmails(brandId);
    await verifyDetectStuckPlans(brandId);
  } finally {
    process.stdout.write('\nCleaning up test data… ');
    await cleanupRegistered();
    // Double-check: sweep marker again in case any plan escaped registration
    await sweepOldTestData();
    console.log('done');
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('Unhandled error:', e); process.exit(1); });
