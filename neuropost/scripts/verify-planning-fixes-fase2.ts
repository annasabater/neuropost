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
// All test data is cleaned in the finally block even on failure.
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

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CRON_SECRET   = process.env.CRON_SECRET!;
const BASE_URL      = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

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

// ─── helpers ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const cleanup: { table: string; id: string }[] = [];

function pass(name: string) { console.log(`  ✓ ${name}`); passed++; }
function fail(name: string, detail: string) { console.error(`  ✗ ${name}: ${detail}`); failed++; }

async function assert(name: string, fn: () => Promise<void>) {
  try { await fn(); pass(name); }
  catch (e) { fail(name, e instanceof Error ? e.message : String(e)); }
}

async function cleanupAll() {
  for (const { table, id } of cleanup.reverse()) {
    try { await db.from(table).delete().eq('id', id); } catch { /* best-effort */ }
  }
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function callCron(path: string): Promise<{ ok: boolean; body: Record<string, unknown> }> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Authorization': `Bearer ${CRON_SECRET}` },
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.json() as Record<string, unknown>;
    return { ok: res.ok, body };
  } catch (e) {
    throw new Error(`fetch ${path} failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ─── fixture helpers ──────────────────────────────────────────────────────────

async function getTestBrand(): Promise<string> {
  const { data, error } = await db
    .from('brands').select('id').eq('use_new_planning_flow', true).limit(1).single();
  if (error || !data) throw new Error(`No brand with use_new_planning_flow=true: ${error?.message ?? 'not found'}`);
  return data.id as string;
}

async function createTestPlan(brandId: string, overrides: Record<string, unknown> = {}): Promise<string> {
  const ts = Date.now();
  const year  = 2090 + (ts % 9);
  const month = String(1 + (Math.floor(ts / 1000) % 12)).padStart(2, '0');
  const day   = String(1 + (Math.floor(ts / 100)  % 28)).padStart(2, '0');
  const { data, error } = await db.from('weekly_plans').insert({
    brand_id:   brandId,
    week_start: `${year}-${month}-${day}`,
    status:     'ideas_ready',
    ...overrides,
  }).select('id').single();
  if (error || !data) throw new Error(`createTestPlan: ${error?.message}`);
  cleanup.push({ table: 'weekly_plans', id: data.id as string });
  return data.id as string;
}

async function createTestIdea(planId: string, brandId: string, overrides: Record<string, unknown> = {}): Promise<string> {
  const { data, error } = await db.from('content_ideas').insert({
    week_id:      planId,
    brand_id:     brandId,
    content_kind: 'story',
    format:       'story',
    angle:        '__test_fase2',
    position:     99,
    render_status: 'pending_render',
    render_attempts: 0,
    ...overrides,
  }).select('id').single();
  if (error || !data) throw new Error(`createTestIdea: ${error?.message}`);
  cleanup.push({ table: 'content_ideas', id: data.id as string });
  return data.id as string;
}

// ─── patch created_at (required to simulate "old" records) ───────────────────

async function backdateIdea(ideaId: string, minutesAgo: number) {
  const ts = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
  await db.from('content_ideas').update({ created_at: ts }).eq('id', ideaId);
}

async function backdatePlan(planId: string, hoursAgo: number) {
  const ts = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
  await db.from('weekly_plans').update({ created_at: ts }).eq('id', planId);
}

// ─── verifyReconcileRenders ───────────────────────────────────────────────────

async function verifyReconcileRenders(brandId: string) {
  console.log('\nreconcileRenders:');

  // Case 1: pending_render older than 5 min → should be picked
  const planId  = await createTestPlan(brandId);
  const ideaId1 = await createTestIdea(planId, brandId, { render_status: 'pending_render', render_attempts: 0 });
  await backdateIdea(ideaId1, 10); // 10 min ago

  const res1 = await callCron('/api/cron/reconcile-renders');
  await assert('picks up pending_render older than 5min', async () => {
    if (!res1.ok) throw new Error(`cron returned error: ${JSON.stringify(res1.body)}`);
    if (typeof res1.body.picked !== 'number' || (res1.body.picked as number) < 1) {
      throw new Error(`expected picked>=1, got ${res1.body.picked}`);
    }
    // render_attempts should have incremented
    await sleep(500);
    const { data } = await db.from('content_ideas').select('render_attempts').eq('id', ideaId1).single();
    if (!data || data.render_attempts < 1) throw new Error(`render_attempts not incremented (got ${data?.render_attempts})`);
  });

  // Case 2: render_failed with attempts>=3 → must NOT be retriggered
  const ideaId2 = await createTestIdea(planId, brandId, { render_status: 'render_failed', render_attempts: 3 });
  await backdateIdea(ideaId2, 10);

  const res2 = await callCron('/api/cron/reconcile-renders');
  await assert('ignores render_failed with attempts>=3', async () => {
    if (!res2.ok) throw new Error(`cron error: ${JSON.stringify(res2.body)}`);
    const { data } = await db.from('content_ideas').select('render_status, render_error').eq('id', ideaId2).single();
    if (data?.render_status !== 'render_failed') throw new Error(`Expected render_failed, got ${data?.render_status}`);
    if (data?.render_error !== 'max_attempts_exceeded') throw new Error(`Expected max_attempts_exceeded error`);
  });

  // Case 3: stuck 'rendering' with render_started_at > 5 min → gets reset and retriggered
  const ideaId3 = await createTestIdea(planId, brandId, {
    render_status: 'rendering',
    render_started_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    render_attempts: 0,
  });

  const res3 = await callCron('/api/cron/reconcile-renders');
  await assert('re-picks rendering stuck for >5min', async () => {
    if (!res3.ok) throw new Error(`cron error: ${JSON.stringify(res3.body)}`);
    if (typeof res3.body.stuck_reset !== 'number' || (res3.body.stuck_reset as number) < 1) {
      throw new Error(`expected stuck_reset>=1, got ${res3.body.stuck_reset}`);
    }
  });
}

// ─── verifyReconcileEmails ────────────────────────────────────────────────────

async function verifyReconcileEmails(brandId: string) {
  console.log('\nreconcileEmails:');

  // Case 1: failed email with attempts<3 → cron should retry (even if email itself fails in test)
  const planId1 = await createTestPlan(brandId, { client_email_status: 'failed', client_email_attempts: 1 });

  const res1 = await callCron('/api/cron/reconcile-client-emails');
  await assert('retries failed email with attempts<3', async () => {
    if (!res1.ok) throw new Error(`cron error: ${JSON.stringify(res1.body)}`);
    if (typeof res1.body.retried !== 'number' || (res1.body.retried as number) < 1) {
      throw new Error(`expected retried>=1, got ${res1.body.retried}`);
    }
    // client_email_attempts should have changed (either succeeded→0 attempts shown, or failed→incremented)
    await sleep(500);
    const { data } = await db.from('weekly_plans').select('client_email_attempts, client_email_status').eq('id', planId1).single();
    if (!data) throw new Error('plan not found after retry');
    // Status should no longer be 'pending' (it was claimed and processed)
    if (data.client_email_status === 'pending') throw new Error('status stuck at pending after processing');
  });

  // Case 2: failed email with attempts>=3 → cron must NOT touch it
  const planId2 = await createTestPlan(brandId, { client_email_status: 'failed', client_email_attempts: 3 });

  const res2 = await callCron('/api/cron/reconcile-client-emails');
  await assert('ignores email with attempts>=3', async () => {
    if (!res2.ok) throw new Error(`cron error: ${JSON.stringify(res2.body)}`);
    // The plan should remain untouched (cron query filters attempts < 3)
    const { data } = await db.from('weekly_plans').select('client_email_status, client_email_attempts').eq('id', planId2).single();
    if (data?.client_email_attempts !== 3) throw new Error(`Attempts changed unexpectedly: ${data?.client_email_attempts}`);
  });
}

// ─── verifyDetectStuckPlans ───────────────────────────────────────────────────

async function verifyDetectStuckPlans(brandId: string) {
  console.log('\ndetectStuckPlans:');

  // Case 1: generating > 10 min → expires
  const planId1 = await createTestPlan(brandId, { status: 'generating' });
  await backdatePlan(planId1, 1); // 1 hour ago (definitely > 10 min)

  const res1 = await callCron('/api/cron/detect-stuck-plans');
  await assert('expires generating >10min', async () => {
    if (!res1.ok) throw new Error(`cron error: ${JSON.stringify(res1.body)}`);
    if (typeof res1.body.stuck_generating_expired !== 'number' || (res1.body.stuck_generating_expired as number) < 1) {
      throw new Error(`expected stuck_generating_expired>=1, got ${res1.body.stuck_generating_expired}`);
    }
    const { data } = await db.from('weekly_plans').select('status, skip_reason').eq('id', planId1).single();
    if (data?.status !== 'expired') throw new Error(`Expected expired, got ${data?.status}`);
    if (data?.skip_reason !== 'stuck_in_generating_over_10_minutes') {
      throw new Error(`Wrong skip_reason: ${data?.skip_reason}`);
    }
  });

  // Case 2: ideas_ready with failed notification > 30 min → alert only (no status change)
  const planId2 = await createTestPlan(brandId, {
    status: 'ideas_ready',
    worker_notify_status: 'pending',
  });
  await backdatePlan(planId2, 1); // 1 hour ago

  const res2 = await callCron('/api/cron/detect-stuck-plans');
  await assert('alerts ideas_ready with failed notification >30min (no status change)', async () => {
    if (!res2.ok) throw new Error(`cron error: ${JSON.stringify(res2.body)}`);
    if (typeof res2.body.stuck_unnotified_alerted !== 'number' || (res2.body.stuck_unnotified_alerted as number) < 1) {
      throw new Error(`expected stuck_unnotified_alerted>=1, got ${res2.body.stuck_unnotified_alerted}`);
    }
    // Status must NOT have changed
    const { data } = await db.from('weekly_plans').select('status').eq('id', planId2).single();
    if (data?.status !== 'ideas_ready') throw new Error(`Status changed unexpectedly to ${data?.status}`);
  });

  // Case 3: client_reviewing abandoned > 7 days → expires
  const planId3 = await createTestPlan(brandId, { status: 'client_reviewing' });
  await backdatePlan(planId3, 8 * 24); // 8 days ago

  const res3 = await callCron('/api/cron/detect-stuck-plans');
  await assert('expires abandoned plans >7d', async () => {
    if (!res3.ok) throw new Error(`cron error: ${JSON.stringify(res3.body)}`);
    if (typeof res3.body.abandoned_expired !== 'number' || (res3.body.abandoned_expired as number) < 1) {
      throw new Error(`expected abandoned_expired>=1, got ${res3.body.abandoned_expired}`);
    }
    const { data } = await db.from('weekly_plans').select('status, skip_reason').eq('id', planId3).single();
    if (data?.status !== 'expired') throw new Error(`Expected expired, got ${data?.status}`);
    if (data?.skip_reason !== 'abandoned_over_7_days') throw new Error(`Wrong skip_reason: ${data?.skip_reason}`);
  });
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== verify-planning-fixes-fase2 ===\n');

  // Check dev server is reachable
  try {
    const ping = await fetch(`${BASE_URL}/api/cron/health-check`, {
      headers: { 'Authorization': `Bearer ${CRON_SECRET}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!ping.ok && ping.status !== 401) {
      console.warn(`⚠ Dev server at ${BASE_URL} responded with ${ping.status} — some tests may fail`);
    } else {
      console.log(`Dev server: ${BASE_URL} ✓`);
    }
  } catch {
    console.error(`ERROR: Dev server not reachable at ${BASE_URL}`);
    console.error('Start with: pnpm dev, then re-run this script');
    process.exit(1);
  }

  let brandId: string;
  try {
    brandId = await getTestBrand();
    console.log(`Using brand: ${brandId}`);

    await verifyReconcileRenders(brandId);
    await verifyReconcileEmails(brandId);
    await verifyDetectStuckPlans(brandId);

  } finally {
    process.stdout.write('\nCleaning up test data… ');
    await cleanupAll();
    console.log('done');
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('Unhandled error:', e); process.exit(1); });
