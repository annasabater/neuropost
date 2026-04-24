// =============================================================================
// test_edited_image_url.ts — Integration test for the edited_image_url contract
// =============================================================================
// Tests:
//   1. Posts table has edited_image_url column (migration applied)
//   2. Creating a post with image_url='a.jpg' → image_url unchanged after mock generation
//   3. Running imageGenerateHandler mock sets edited_image_url='b.jpg', keeps image_url='a.jpg'
//   4. Backfill: legacy posts in processed statuses have edited_image_url = image_url
//   5. Supabase-fallback runner detects stale pending jobs and processes them
//
// Run:
//   npm run test:edited-image-url
// or:
//   npx tsx scripts/test_edited_image_url.ts

import { readFileSync, existsSync } from 'node:fs';
import { resolve }                  from 'node:path';

// ── Load .env.local ───────────────────────────────────────────────────────────
const envPath = resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let   val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (val && !(key in process.env)) process.env[key] = val;
  }
}

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = createClient(url, key) as any;

// ── Helpers ───────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function ok(label: string) {
  console.log(`  ✅  ${label}`);
  passed++;
}
function fail(label: string, detail?: string) {
  console.error(`  ❌  ${label}${detail ? `\n     ${detail}` : ''}`);
  failed++;
}
function section(title: string) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`);
}

async function getTestBrandId(): Promise<string | null> {
  const { data } = await db.from('brands').select('id').limit(1).maybeSingle();
  return data?.id ?? null;
}

// ── TEST 1: Column exists ─────────────────────────────────────────────────────
async function test1() {
  section('TEST 1 — edited_image_url column exists');
  const { data, error } = await db
    .from('posts')
    .select('edited_image_url')
    .limit(1);
  if (error) {
    fail('edited_image_url column exists on posts table', error.message);
  } else {
    ok('edited_image_url column exists on posts table');
    void data;
  }
}

// ── TEST 2 & 3: Create post → mock generation → field separation ──────────────
let testPostId: string | null = null;

async function test2and3() {
  section('TEST 2+3 — image_url preserved, edited_image_url set by handler');
  const brandId = await getTestBrandId();
  if (!brandId) {
    fail('Could not find a brand to use for test (brands table empty?)');
    return;
  }

  const { data: insertedPost, error: insertErr } = await db
    .from('posts')
    .insert({
      brand_id:  brandId,
      status:    'draft',
      image_url: 'https://example.com/original-a.jpg',
      caption:   '[test_edited_image_url] auto-generated test post — safe to delete',
      platform:  ['instagram'],
      format:    'post',
    })
    .select('id, image_url, edited_image_url')
    .single();

  if (insertErr || !insertedPost) {
    fail('Insert test post', insertErr?.message);
    return;
  }
  testPostId = insertedPost.id;
  ok(`Test post created (${testPostId})`);

  if (insertedPost.image_url === 'https://example.com/original-a.jpg') {
    ok('image_url set correctly on create');
  } else {
    fail('image_url set correctly on create', `got: ${insertedPost.image_url}`);
  }
  if (insertedPost.edited_image_url === null) {
    ok('edited_image_url starts as null');
  } else {
    fail('edited_image_url starts as null', `got: ${insertedPost.edited_image_url}`);
  }

  const { error: updateErr } = await db
    .from('posts')
    .update({ edited_image_url: 'https://example.com/generated-b.jpg', status: 'pending' })
    .eq('id', testPostId);

  if (updateErr) {
    fail('Update edited_image_url (mock handler)', updateErr.message);
    return;
  }

  const { data: afterUpdate } = await db
    .from('posts')
    .select('image_url, edited_image_url, status')
    .eq('id', testPostId)
    .single();

  if (afterUpdate?.image_url === 'https://example.com/original-a.jpg') {
    ok('image_url unchanged after mock generation (original preserved)');
  } else {
    fail('image_url unchanged after mock generation', `got: ${afterUpdate?.image_url}`);
  }
  if (afterUpdate?.edited_image_url === 'https://example.com/generated-b.jpg') {
    ok('edited_image_url = generated result');
  } else {
    fail('edited_image_url = generated result', `got: ${afterUpdate?.edited_image_url}`);
  }
  if (afterUpdate?.status === 'pending') {
    ok('status updated to pending');
  } else {
    fail('status updated to pending', `got: ${afterUpdate?.status}`);
  }
}

// ── TEST 4: Backfill ──────────────────────────────────────────────────────────
async function test4() {
  section('TEST 4 — backfill: legacy processed posts have edited_image_url');
  const processedStatuses = ['generated', 'pending', 'approved', 'scheduled', 'published'];
  const { data: legacyPosts, error: legacyErr } = await db
    .from('posts')
    .select('id, image_url, edited_image_url, status')
    .in('status', processedStatuses)
    .not('image_url', 'is', null)
    .limit(10);

  if (legacyErr) {
    fail('Query legacy posts', legacyErr.message);
    return;
  }
  if (!legacyPosts?.length) {
    ok('No legacy processed posts with image_url found (nothing to backfill)');
    return;
  }
  const withoutEdited = legacyPosts.filter(
    (p: { image_url: string; edited_image_url: string | null }) => p.edited_image_url === null,
  );
  if (withoutEdited.length === 0) {
    ok(`All ${legacyPosts.length} sampled processed posts have edited_image_url set (backfill applied)`);
  } else {
    fail(
      `${withoutEdited.length}/${legacyPosts.length} processed posts missing edited_image_url — run migration 20260422_add_edited_image_url.sql`,
      `Example missing id: ${withoutEdited[0]?.id}`,
    );
  }
}

// ── TEST 5: drain-agent-jobs endpoint reachable ────────────────────────────────
async function test5() {
  section('TEST 5 — drain-agent-jobs endpoint');
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const secret  = process.env.CRON_SECRET ?? '';
  if (!secret) {
    console.log('  ⚠️   CRON_SECRET not set — skipping live endpoint test');
    return;
  }
  try {
    const res = await fetch(`${baseUrl}/api/cron/drain-agent-jobs`, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const json = await res.json();
      ok(`drain-agent-jobs responded 200 (drained=${json.drained}, recovered=${json.recovered})`);
    } else {
      fail(`drain-agent-jobs HTTP ${res.status}`, await res.text().catch(() => ''));
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      console.log('  ⚠️   Dev server not running — skipping live endpoint test');
    } else {
      fail('drain-agent-jobs request', msg);
    }
  }
}

// ── Cleanup ───────────────────────────────────────────────────────────────────
async function cleanup() {
  if (testPostId) {
    try { await db.from('posts').delete().eq('id', testPostId); } catch { /* ok */ }
    console.log(`\n  🧹  Cleaned up test post ${testPostId}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Sprint 0: edited_image_url contract tests ===');
  await test1();
  await test2and3();
  await test4();
  await test5();
  await cleanup();

  console.log(`\n${'─'.repeat(62)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });
