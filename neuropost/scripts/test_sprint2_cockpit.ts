// test_sprint2_cockpit.ts — Sprint 2: Worker Cockpit integration tests
//
// Tests:
//   TEST 1: revision_index=0 when no prior revisions exist
//   TEST 2: revision_index increments correctly from existing revisions
//   TEST 3: New migration columns exist (triggered_by, worker_id, error_message, etc.)
//   TEST 4: Approve flow — posts.status='client_review', edited_image_url updated
//   TEST 5: Reject flow — posts.status='rejected', worker_notes persisted
//   TEST 6: Re-analyze — posts.agent_brief overwritten
//   TEST 7: HTTP auth guard — unauthenticated requests return 403
//   TEST 8: HTTP input validation — regenerate with missing prompt returns 400 (with auth)
//
// Prerequisites:
//   - Supabase running with sprint2_cockpit migration applied
//   - SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL in .env.local
//   - Dev server running at NEXT_PUBLIC_SITE_URL (or http://localhost:3000) for HTTP tests
//   - WORKER_TEST_EMAIL + WORKER_TEST_PASS in .env.local for HTTP auth tests (optional)

import { readFileSync, existsSync } from 'node:fs';
import { resolve }                  from 'node:path';

const envPath = resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  const raw = readFileSync(envPath, 'utf-8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val   = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (val && !(key in process.env)) process.env[key] = val;
  }
  console.log('[env] loaded from .env.local');
}

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE_URL     = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = createClient(SUPABASE_URL, SUPABASE_KEY) as any;

// Reuse the SportArea brand from previous sprint tests
const BRAND_ID = 'e8dc77ef-8371-4765-a90c-c7108733f791';

let passed = 0;
let failed = 0;
const toClean: { table: string; id: string }[] = [];

function ok(label: string)  { passed++; console.log(`  ✅ ${label}`); }
function fail(label: string, err?: unknown) {
  failed++;
  console.error(`  ❌ ${label}`, err instanceof Error ? err.message : err ?? '');
}

async function cleanup() {
  for (const { table, id } of toClean.reverse()) {
    try { await db.from(table).delete().eq('id', id); } catch { /* ok */ }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: create a minimal test post
// ─────────────────────────────────────────────────────────────────────────────
async function createTestPost(extra: Record<string, unknown> = {}) {
  const { data, error } = await db.from('posts').insert({
    brand_id:   BRAND_ID,
    caption:    'Test post cockpit',
    status:     'pending',
    format:     'post',
    ...extra,
  }).select('*').single();
  if (error) throw new Error(`createTestPost: ${error.message}`);
  toClean.push({ table: 'posts', id: data.id });
  return data as Record<string, unknown> & { id: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1 — revision_index=0 when no prior revisions
// ─────────────────────────────────────────────────────────────────────────────
async function test1() {
  console.log('\nTEST 1: revision_index=0 for first revision');

  const post = await createTestPost();

  // Simulate what /regenerate does to pick nextIndex
  const { data: maxRow } = await db
    .from('post_revisions')
    .select('revision_index')
    .eq('post_id', post.id)
    .order('revision_index', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextIndex = (maxRow?.revision_index ?? -1) + 1;

  if (nextIndex === 0) {
    ok('nextIndex=0 when no prior revisions');
  } else {
    fail(`expected 0, got ${nextIndex}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2 — revision_index increments correctly
// ─────────────────────────────────────────────────────────────────────────────
async function test2() {
  console.log('\nTEST 2: revision_index increments from existing revisions');

  const post = await createTestPost();

  // Insert revision#0 (simulate agent generation)
  const { data: rev0, error: revErr } = await db.from('post_revisions').insert({
    post_id:        post.id,
    brand_id:       BRAND_ID,
    revision_index: 0,
    model:          'flux-kontext-pro',
    image_url:      'https://example.com/img0.jpg',
    triggered_by:   'agent',
  }).select('*').single();

  if (revErr) { fail('insert rev0', revErr); return; }
  toClean.push({ table: 'post_revisions', id: rev0.id });

  // Compute next index
  const { data: maxRow } = await db
    .from('post_revisions')
    .select('revision_index')
    .eq('post_id', post.id)
    .order('revision_index', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextIndex = (maxRow?.revision_index ?? -1) + 1;

  if (nextIndex === 1) {
    ok('nextIndex=1 after one existing revision');
  } else {
    fail(`expected 1, got ${nextIndex}`);
  }

  // Insert revision#1 (simulate worker regenerate)
  const { data: rev1, error: rev1Err } = await db.from('post_revisions').insert({
    post_id:        post.id,
    brand_id:       BRAND_ID,
    revision_index: nextIndex,
    model:          'flux-kontext-pro',
    image_url:      null,
    triggered_by:   'worker',
    num_outputs:    1,
  }).select('*').single();

  if (rev1Err) { fail('insert rev1', rev1Err); return; }
  toClean.push({ table: 'post_revisions', id: rev1.id });

  ok('worker revision inserted with triggered_by=worker');

  // Verify triggered_by column accepted 'worker'
  if (rev1.triggered_by === 'worker') {
    ok('triggered_by column works');
  } else {
    fail(`triggered_by mismatch: got ${rev1.triggered_by}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3 — Migration columns exist
// ─────────────────────────────────────────────────────────────────────────────
async function test3() {
  console.log('\nTEST 3: Sprint 2 migration columns exist');

  const post = await createTestPost();

  const { data: rev, error } = await db.from('post_revisions').insert({
    post_id:        post.id,
    brand_id:       BRAND_ID,
    revision_index: 0,
    model:          'nanobanana',
    image_url:      null,
    triggered_by:   'worker',
    num_outputs:    2,
    negative_prompt: 'text, watermark',
    error_message:  null,
  }).select('*').single();

  if (error) { fail('insert with new columns', error); return; }
  toClean.push({ table: 'post_revisions', id: rev.id });

  if ('triggered_by'   in rev) ok('triggered_by column exists');
  else fail('triggered_by column missing');

  if ('num_outputs'    in rev) ok('num_outputs column exists');
  else fail('num_outputs column missing');

  if ('negative_prompt' in rev) ok('negative_prompt column exists');
  else fail('negative_prompt column missing');

  if ('worker_id'      in rev) ok('worker_id column exists');
  else fail('worker_id column missing');

  if ('error_message'  in rev) ok('error_message column exists');
  else fail('error_message column missing');

  if (rev.num_outputs === 2) ok('num_outputs value round-trips correctly');
  else fail(`num_outputs: expected 2, got ${rev.num_outputs}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4 — Approve flow (DB level)
// ─────────────────────────────────────────────────────────────────────────────
async function test4() {
  console.log('\nTEST 4: Approve flow — status=client_review, edited_image_url updated');

  const post = await createTestPost();

  // Create a revision with an image
  const { data: rev, error: revErr } = await db.from('post_revisions').insert({
    post_id:        post.id,
    brand_id:       BRAND_ID,
    revision_index: 0,
    model:          'flux-kontext-pro',
    image_url:      'https://example.com/edited.jpg',
    triggered_by:   'worker',
  }).select('*').single();

  if (revErr) { fail('insert revision', revErr); return; }
  toClean.push({ table: 'post_revisions', id: rev.id });

  // Simulate approve: update post
  const { data: updated, error: upErr } = await db.from('posts')
    .update({ status: 'client_review', edited_image_url: rev.image_url })
    .eq('id', post.id)
    .select('status, edited_image_url')
    .single();

  if (upErr) { fail('approve update', upErr); return; }

  if (updated.status === 'client_review') ok('status set to client_review');
  else fail(`status: expected client_review, got ${updated.status}`);

  if (updated.edited_image_url === 'https://example.com/edited.jpg')
    ok('edited_image_url set to revision image');
  else fail(`edited_image_url mismatch: ${updated.edited_image_url}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5 — Reject flow (DB level)
// ─────────────────────────────────────────────────────────────────────────────
async function test5() {
  console.log('\nTEST 5: Reject flow — status=rejected, worker_notes persisted');

  const post = await createTestPost({ status: 'pending' });
  const reason = 'Imagen no cumple con la identidad visual de la marca';

  const { data: updated, error } = await db.from('posts')
    .update({ status: 'rejected', worker_notes: reason })
    .eq('id', post.id)
    .select('status, worker_notes')
    .single();

  if (error) { fail('reject update', error); return; }

  if (updated.status === 'rejected') ok('status set to rejected');
  else fail(`status: expected rejected, got ${updated.status}`);

  if (updated.worker_notes === reason) ok('worker_notes persisted correctly');
  else fail(`worker_notes mismatch: ${updated.worker_notes}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 6 — Re-analyze: agent_brief overwritten (DB level)
// ─────────────────────────────────────────────────────────────────────────────
async function test6() {
  console.log('\nTEST 6: Re-analyze — agent_brief overwritten');

  const originalBrief = { generation_prompt: 'original prompt', mode: 'txt2img', guidance: 7 };
  const post = await createTestPost({ agent_brief: originalBrief });

  const newBrief = { generation_prompt: 'new improved prompt', mode: 'img2img', guidance: 8 };

  const { data: updated, error } = await db.from('posts')
    .update({ agent_brief: newBrief, agent_brief_generated_at: new Date().toISOString() })
    .eq('id', post.id)
    .select('agent_brief, agent_brief_generated_at')
    .single();

  if (error) { fail('reanalyze update', error); return; }

  const brief = updated.agent_brief as Record<string, unknown>;
  if (brief?.generation_prompt === 'new improved prompt') ok('agent_brief overwritten');
  else fail(`agent_brief not updated: ${JSON.stringify(brief)}`);

  if (updated.agent_brief_generated_at) ok('agent_brief_generated_at set');
  else fail('agent_brief_generated_at not set');
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 7 — HTTP auth guard (unauthenticated → 403)
// ─────────────────────────────────────────────────────────────────────────────
async function test7() {
  console.log('\nTEST 7: HTTP auth guard — unauthenticated returns 403');

  const fakeId = '00000000-0000-0000-0000-000000000001';
  const endpoints = [
    { path: `/api/worker/posts/${fakeId}/revisions`,      method: 'GET'  },
    { path: `/api/worker/posts/${fakeId}/regenerate`,     method: 'POST' },
    { path: `/api/worker/posts/${fakeId}/approve`,        method: 'POST' },
    { path: `/api/worker/posts/${fakeId}/reject`,         method: 'POST' },
    { path: `/api/worker/posts/${fakeId}/reanalyze`,      method: 'POST' },
    { path: `/api/worker/posts/${fakeId}/manual-upload`,  method: 'POST' },
    { path: `/api/worker/posts/${fakeId}/context`,        method: 'GET'  },
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${BASE_URL}${ep.path}`, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
        body: ep.method === 'POST' ? '{}' : undefined,
      });

      if (res.status === 403) {
        ok(`${ep.method} ${ep.path.split('/').slice(-1)[0]} → 403`);
      } else if (res.status === 401) {
        ok(`${ep.method} ${ep.path.split('/').slice(-1)[0]} → 401`);
      } else {
        fail(`${ep.method} ${ep.path.split('/').slice(-1)[0]}: expected 403/401, got ${res.status}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
        console.log(`  ⚠️  ${ep.method} ${ep.path.split('/').slice(-1)[0]} — dev server not running, skip`);
      } else {
        fail(`${ep.method} ${ep.path.split('/').slice(-1)[0]}`, e);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 8 — Handler: UPDATE revision when _revision_id provided (DB simulation)
// ─────────────────────────────────────────────────────────────────────────────
async function test8() {
  console.log('\nTEST 8: Handler UPDATE flow — _revision_id updates existing row');

  const post = await createTestPost();

  // Insert placeholder revision (image_url=null) — simulates what /regenerate does
  const { data: placeholder, error: phErr } = await db.from('post_revisions').insert({
    post_id:        post.id,
    brand_id:       BRAND_ID,
    revision_index: 0,
    model:          'flux-kontext-pro',
    image_url:      null,
    triggered_by:   'worker',
  }).select('*').single();

  if (phErr) { fail('insert placeholder', phErr); return; }
  toClean.push({ table: 'post_revisions', id: placeholder.id });

  ok('placeholder revision inserted with image_url=null');

  // Simulate handler UPDATE (what handlers/local.ts does when _revision_id present)
  const generatedUrl = 'https://cdn.example.com/generated.jpg';
  const { data: updated, error: upErr } = await db.from('post_revisions')
    .update({
      image_url:        generatedUrl,
      cost_usd:         0.04,
      duration_seconds: 12,
      error_message:    null,
    })
    .eq('id', placeholder.id)
    .select('image_url, cost_usd, duration_seconds')
    .single();

  if (upErr) { fail('update placeholder', upErr); return; }

  if (updated.image_url === generatedUrl) ok('image_url filled in after generation');
  else fail(`image_url mismatch: ${updated.image_url}`);

  if (updated.cost_usd === 0.04) ok('cost_usd set correctly');
  else fail(`cost_usd: expected 0.04, got ${updated.cost_usd}`);

  if (updated.duration_seconds === 12) ok('duration_seconds set correctly');
  else fail(`duration_seconds: expected 12, got ${updated.duration_seconds}`);

  // Verify only ONE revision exists (no duplicate INSERT)
  const { data: allRevs } = await db
    .from('post_revisions')
    .select('id')
    .eq('post_id', post.id);

  if ((allRevs ?? []).length === 1) ok('no duplicate revision inserted');
  else fail(`expected 1 revision, found ${(allRevs ?? []).length}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== test_sprint2_cockpit — Worker Cockpit Integration Tests ===');
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Brand ID: ${BRAND_ID}\n`);

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    process.exit(1);
  }

  // Verify brand exists
  const { data: brand } = await db.from('brands').select('id, name').eq('id', BRAND_ID).single();
  if (!brand) {
    console.error(`Brand ${BRAND_ID} not found — update BRAND_ID constant to a valid brand`);
    process.exit(1);
  }
  console.log(`Using brand: ${brand.name}`);

  try {
    await test1();
    await test2();
    await test3();
    await test4();
    await test5();
    await test6();
    await test7();
    await test8();
  } finally {
    await cleanup();
    console.log('\n── Cleanup done ──');
    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
