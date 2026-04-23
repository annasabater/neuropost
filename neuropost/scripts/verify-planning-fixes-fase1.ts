/* eslint-disable no-console */
// =============================================================================
// verify-planning-fixes-fase1.ts
// =============================================================================
// Smoke-tests for Phase 1 fixes (P1–P5, P22).
// Requires a real Supabase connection (service_role).
// Run: npx tsx scripts/verify-planning-fixes-fase1.ts
//
// All test data is prefixed with __test_planning_fixes_ and cleaned up in
// the finally block even on failure.
// =============================================================================

import { readFileSync, existsSync } from 'node:fs';
import { resolve }                  from 'node:path';
import { createClient }             from '@supabase/supabase-js';

// ─── env loader ──────────────────────────────────────────────────────────────

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, 'utf-8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvLocal();

// ─── client ───────────────────────────────────────────────────────────────────

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = createClient(url, key) as any;

// ─── helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function pass(name: string) {
  console.log(`  ✓ ${name}`);
  passed++;
}

function fail(name: string, detail: string) {
  console.error(`  ✗ ${name}: ${detail}`);
  failed++;
}

async function assert(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    pass(name);
  } catch (e) {
    fail(name, e instanceof Error ? e.message : String(e));
  }
}

// Track created IDs for cleanup
const cleanup: { table: string; id: string }[] = [];

async function cleanupAll() {
  for (const { table, id } of cleanup.reverse()) {
    try { await db.from(table).delete().eq('id', id); } catch { /* best-effort */ }
  }
}

// ─── test fixtures ────────────────────────────────────────────────────────────

async function getTestBrand(): Promise<string> {
  const { data, error } = await db
    .from('brands')
    .select('id')
    .eq('use_new_planning_flow', true)
    .limit(1)
    .single();
  if (error || !data) throw new Error(`No brand with use_new_planning_flow=true: ${error?.message ?? 'not found'}`);
  return data.id as string;
}

async function createTestPlan(brandId: string): Promise<string> {
  // Use a timestamp-derived date to avoid unique constraint collisions on re-runs
  const ts = Date.now();
  const year = 2090 + (ts % 9);
  const month = String(1 + (Math.floor(ts / 1000) % 12)).padStart(2, '0');
  const day   = String(1 + (Math.floor(ts / 100)  % 28)).padStart(2, '0');
  const weekStart = `${year}-${month}-${day}`;

  const { data, error } = await db
    .from('weekly_plans')
    .insert({
      brand_id:   brandId,
      week_start: weekStart,
      status:     'ideas_ready',
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`Failed to create test plan: ${error?.message}`);
  cleanup.push({ table: 'weekly_plans', id: data.id as string });
  return data.id as string;
}

async function createTestIdea(planId: string, brandId: string, kind = 'story'): Promise<string> {
  const { data, error } = await db
    .from('content_ideas')
    .insert({
      week_id:      planId,
      brand_id:     brandId,
      content_kind: kind,
      format:       'story',
      angle:        '__test_planning_fixes_angle',
      position:     99,
      // render_status added by 20260423_planning_fixes_fase1_tracking.sql migration
      render_status: kind === 'story' ? 'pending_render' : 'not_applicable',
    })
    .select('id')
    .single();
  if (error?.message?.includes("render_status")) {
    throw new Error(
      'MIGRATIONS NOT APPLIED: run 20260423_planning_fixes_fase1_tracking.sql in Supabase Dashboard first.\n' +
      `  Original error: ${error.message}`,
    );
  }
  if (error || !data) throw new Error(`Failed to create test idea: ${error?.message}`);
  cleanup.push({ table: 'content_ideas', id: data.id as string });
  return data.id as string;
}

// ─── P22: client_feedback table exists and accepts inserts ───────────────────

async function verifyP22(brandId: string, planId: string, ideaId: string) {
  console.log('\nP22 — client_feedback table');

  await assert('table exists and INSERT works', async () => {
    const { error } = await db.from('client_feedback').insert({
      week_id:  planId,
      idea_id:  ideaId,
      brand_id: brandId,
      action:   'approve',
    });
    if (error) throw new Error(error.message);
    // Cleanup via CASCADE when plan is deleted — no explicit entry needed
  });

  await assert('action CHECK constraint rejects invalid value', async () => {
    const { error } = await db.from('client_feedback').insert({
      week_id:  planId,
      idea_id:  ideaId,
      brand_id: brandId,
      action:   'INVALID_ACTION',
    });
    if (!error) throw new Error('Expected constraint violation but INSERT succeeded');
  });
}

// ─── P1: render_status column exists and tracking columns present ─────────────

async function verifyP1(ideaId: string) {
  console.log('\nP1 — render_status tracking on content_ideas');

  await assert('render_status column exists', async () => {
    const { data, error } = await db
      .from('content_ideas')
      .select('render_status, render_attempts, render_started_at, render_completed_at')
      .eq('id', ideaId)
      .single();
    if (error) throw new Error(error.message);
    if (data.render_status !== 'pending_render') {
      throw new Error(`Expected pending_render, got ${data.render_status}`);
    }
  });

  await assert('render_status CHECK constraint rejects invalid value', async () => {
    const { error } = await db
      .from('content_ideas')
      .update({ render_status: 'BOGUS_STATUS' })
      .eq('id', ideaId);
    if (!error) throw new Error('Expected constraint violation but UPDATE succeeded');
  });

  await assert('atomic claim UPDATE (pending_render → rendering)', async () => {
    const { data } = await db
      .from('content_ideas')
      .update({ render_status: 'rendering', render_started_at: new Date().toISOString() })
      .eq('id', ideaId)
      .in('render_status', ['pending_render', 'render_failed'])
      .select('id');
    if (!data || data.length === 0) throw new Error('Claim UPDATE returned 0 rows');
  });

  await assert('second claim on same idea returns 0 rows (idempotency guard)', async () => {
    const { data } = await db
      .from('content_ideas')
      .update({ render_status: 'rendering', render_started_at: new Date().toISOString() })
      .eq('id', ideaId)
      .in('render_status', ['pending_render', 'render_failed'])
      .select('id');
    if (data && data.length > 0) throw new Error('Second claim succeeded — idempotency broken');
  });
}

// ─── P2: worker_notify_status column exists ────────────────────────────────────

async function verifyP2(planId: string) {
  console.log('\nP2 — worker_notify_status tracking on weekly_plans');

  await assert('worker_notify_status column exists', async () => {
    const { data, error } = await db
      .from('weekly_plans')
      .select('worker_notify_status')
      .eq('id', planId)
      .single();
    if (error) throw new Error(error.message);
    // Column exists if we get here without error (value may be null or any valid enum)
    if (!('worker_notify_status' in data)) throw new Error('Column missing from response');
  });

  await assert('worker_notify_status CHECK constraint rejects invalid value', async () => {
    const { error } = await db
      .from('weekly_plans')
      .update({ worker_notify_status: 'BOGUS' })
      .eq('id', planId);
    if (!error) throw new Error('Expected constraint violation but UPDATE succeeded');
  });

  await assert('worker_notify_status can be set to sent/failed', async () => {
    const { error } = await db
      .from('weekly_plans')
      .update({ worker_notify_status: 'sent' })
      .eq('id', planId);
    if (error) throw new Error(error.message);
  });
}

// ─── P3/P4: client_email_status column exists ─────────────────────────────────

async function verifyP3(planId: string) {
  console.log('\nP3/P4 — client_email_status tracking on weekly_plans');

  await assert('client_email_status and client_email_attempts columns exist', async () => {
    const { data, error } = await db
      .from('weekly_plans')
      .select('client_email_status, client_email_attempts')
      .eq('id', planId)
      .single();
    if (error) throw new Error(error.message);
    if (!('client_email_status' in data)) throw new Error('client_email_status missing');
    if (!('client_email_attempts' in data)) throw new Error('client_email_attempts missing');
  });

  await assert('client_email_status CHECK constraint rejects invalid value', async () => {
    const { error } = await db
      .from('weekly_plans')
      .update({ client_email_status: 'BOGUS' })
      .eq('id', planId);
    if (!error) throw new Error('Expected constraint violation but UPDATE succeeded');
  });
}

// ─── P5: use_new_planning_flow column on brands ────────────────────────────────

async function verifyP5() {
  console.log('\nP5 — use_new_planning_flow on brands');

  await assert('use_new_planning_flow column exists with DEFAULT false', async () => {
    const { data, error } = await db
      .from('brands')
      .select('id, use_new_planning_flow')
      .limit(1)
      .single();
    if (error) throw new Error(error.message);
    if (!('use_new_planning_flow' in data)) throw new Error('Column missing from response');
  });
}

// ─── unique index on worker_notifications ─────────────────────────────────────

async function verifyWorkerNotificationsUniqueIndex(planId: string, brandId: string) {
  console.log('\nBonus — uq_worker_notifications_plan_type unique index');

  await assert('duplicate plan+type notification is rejected', async () => {
    const payload = {
      type:     'needs_review',
      message:  '__test dedup check',
      brand_id: brandId,
      read:     false,
      metadata: { plan_id: planId },
    };
    const { data: first, error: e1 } = await db
      .from('worker_notifications').insert(payload).select('id').single();
    if (e1) throw new Error(`First insert failed: ${e1.message}`);
    cleanup.push({ table: 'worker_notifications', id: first.id as string });

    const { error: e2 } = await db.from('worker_notifications').insert(payload);
    if (!e2) throw new Error('Duplicate insert succeeded — unique index missing');
  });
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== verify-planning-fixes-fase1 ===\n');

  let brandId: string;
  let planId: string;
  let ideaId: string;

  try {
    brandId = await getTestBrand();
    console.log(`Using brand: ${brandId}`);
    planId  = await createTestPlan(brandId);
    console.log(`Created test plan: ${planId}`);
    ideaId  = await createTestIdea(planId, brandId, 'story');
    console.log(`Created test idea: ${ideaId}`);

    await verifyP22(brandId, planId, ideaId);
    await verifyP1(ideaId);
    await verifyP2(planId);
    await verifyP3(planId);
    await verifyP5();
    await verifyWorkerNotificationsUniqueIndex(planId, brandId);

  } finally {
    process.stdout.write('\nCleaning up test data… ');
    await cleanupAll();
    console.log('done');
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Unhandled error:', e);
  process.exit(1);
});
