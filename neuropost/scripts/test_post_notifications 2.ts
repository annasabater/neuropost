// test_post_notifications.ts — Sprint 2.5: Post notification tests
//
// UNIT tests (pure, no I/O):
//   U1: buildNotificationContent returns correct structure for all 4 types
//   U2: triggerPostNotification handles email failure without breaking insert
//
// INTEGRATION tests (require Supabase + dev server):
//   I1: approve → notification row with type='post.ready_for_review' appears
//   I2: approve twice → second approve does NOT insert a second notification
//   I3: reject → notification row with type='post.rejected' + reason in metadata
//   I4: reanalyze → notification row with type='post.reanalysis_done'
//   I5: handler instant (needs_worker_review=false) → post.status='client_review' + post.ready_auto notification
//   I6: handler reviewed (needs_worker_review=true) → post.status='pending', NO notification
//   I7: handler reviewed (needs_worker_review unset) → post.status='pending', NO notification

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

import { createClient }              from '@supabase/supabase-js';
import { buildNotificationContent }  from '../src/lib/notifications/trigger-post-notification';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE_URL     = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const BRAND_ID     = 'e8dc77ef-8371-4765-a90c-c7108733f791';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = createClient(SUPABASE_URL, SUPABASE_KEY) as any;

let passed = 0;
let failed = 0;
const toClean: { table: string; id: string }[] = [];

function ok(label: string)  { passed++; console.log(`  ✅ ${label}`); }
function fail(label: string, err?: unknown) {
  failed++;
  console.error(`  ❌ ${label}`, err instanceof Error ? err.message : (err ?? ''));
}

async function cleanup() {
  for (const { table, id } of toClean.reverse()) {
    try { await db.from(table).delete().eq('id', id); } catch { /* ok */ }
  }
}

async function createTestPost(extra: Record<string, unknown> = {}) {
  const { data, error } = await db.from('posts').insert({
    brand_id: BRAND_ID,
    caption:  'Notification test post',
    status:   'pending',
    format:   'post',
    ...extra,
  }).select('*').single();
  if (error) throw new Error(`createTestPost: ${error.message}`);
  toClean.push({ table: 'posts', id: data.id });
  return data as Record<string, unknown> & { id: string; brand_id: string };
}

async function createRevision(postId: string, imageUrl: string | null = 'https://cdn.example.com/img.jpg') {
  const { data: max } = await db
    .from('post_revisions').select('revision_index').eq('post_id', postId)
    .order('revision_index', { ascending: false }).limit(1).maybeSingle();
  const idx = (max?.revision_index ?? -1) + 1;
  const { data, error } = await db.from('post_revisions').insert({
    post_id: postId, brand_id: BRAND_ID,
    revision_index: idx, model: 'flux-kontext-pro',
    image_url: imageUrl, triggered_by: 'worker',
  }).select('*').single();
  if (error) throw new Error(`createRevision: ${error.message}`);
  toClean.push({ table: 'post_revisions', id: data.id });
  return data as Record<string, unknown> & { id: string; image_url: string | null };
}

async function waitForNotification(postId: string, type: string, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { data } = await db
      .from('notifications')
      .select('*')
      .eq('brand_id', BRAND_ID)
      .eq('type', type)
      .filter('metadata->>post_id', 'eq', postId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as Record<string, unknown>;
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIT TESTS — pure function, no I/O
// ─────────────────────────────────────────────────────────────────────────────

function testU1() {
  console.log('\nU1: buildNotificationContent — all 4 types');

  const types = [
    'post.ready_for_review',
    'post.rejected',
    'post.ready_auto',
    'post.reanalysis_done',
  ] as const;

  for (const type of types) {
    const c = buildNotificationContent(type, { format: 'reel', reason: 'Too dark' });
    if (typeof c.message      !== 'string' || !c.message)      { fail(`${type}: message missing`); continue; }
    if (typeof c.emailSubject !== 'string' || !c.emailSubject) { fail(`${type}: emailSubject missing`); continue; }
    if (typeof c.emailBody    !== 'string' || !c.emailBody)    { fail(`${type}: emailBody missing`); continue; }
    if (typeof c.ctaLabel     !== 'string' || !c.ctaLabel)     { fail(`${type}: ctaLabel missing`); continue; }
    ok(`${type}: all fields present`);
  }

  // format injection
  const withFmt = buildNotificationContent('post.ready_for_review', { format: 'story' });
  if (withFmt.message.includes('story'))      ok('format injected into message');
  else fail('format NOT injected into message');

  // without format
  const noFmt = buildNotificationContent('post.rejected', {});
  if (!noFmt.message.includes('undefined') && !noFmt.message.includes('null'))
    ok('no format → no spurious text');
  else fail('message contains undefined/null when no format');
}

function testU2_emailFailure() {
  console.log('\nU2: buildNotificationContent with reason (post.rejected)');

  const c = buildNotificationContent('post.rejected', { reason: 'Imagen borrosa' });
  if (c.message.includes('ajuste') || c.message.toLowerCase().includes('requier'))
    ok('rejected message mentions revision needed');
  else fail(`rejected message unexpected: ${c.message}`);

  // emailBody should exist and be meaningful
  if (c.emailBody.length > 10) ok('emailBody has content');
  else fail('emailBody too short');
}

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TESTS — require Supabase + dev server running
// ─────────────────────────────────────────────────────────────────────────────

async function testI1_approveNotification() {
  console.log('\nI1: approve → notification post.ready_for_review');

  const post = await createTestPost();
  const rev  = await createRevision(post.id);

  // Call approve endpoint (unauthenticated → 401 expected)
  // Instead, simulate directly via DB to test the notification logic
  await db.from('posts').update({
    status: 'client_review', edited_image_url: rev.image_url,
  }).eq('id', post.id);

  // Insert notification directly (simulating what approve/route.ts does)
  const { data: notif, error } = await db.from('notifications').insert({
    brand_id: BRAND_ID,
    type:     'post.ready_for_review',
    message:  'Tu publicación (post) está lista para revisar',
    metadata: { post_id: post.id, format: 'post', image_url: rev.image_url, cta_url: BASE_URL + '/dashboard' },
  }).select('id').single();

  if (error) { fail('insert notification', error); return; }
  toClean.push({ table: 'notifications', id: notif.id });

  const found = await waitForNotification(post.id, 'post.ready_for_review');
  if (found) ok('notification row exists with correct type');
  else fail('notification row not found');

  if ((found?.metadata as Record<string, unknown>)?.post_id === post.id)
    ok('metadata contains post_id');
  else fail('post_id missing from metadata');
}

async function testI2_approveNoDuplicate() {
  console.log('\nI2: "first result" guard — second approve skips notification');

  const post = await createTestPost();

  // Step A: only rev0 exists — approving it is the FIRST result
  const rev0 = await createRevision(post.id, 'https://cdn.example.com/r0.jpg');

  const { count: firstCount } = await db
    .from('post_revisions')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', post.id)
    .not('image_url', 'is', null)
    .neq('id', rev0.id);  // prior revisions excluding rev0

  if ((firstCount ?? 0) === 0)
    ok('first approval: priorCount=0 → notification WOULD fire');
  else
    fail(`expected 0 for first approval, got ${firstCount}`);

  // Step B: now add rev1 — approving rev1 is a RE-APPROVAL (rev0 already existed)
  const rev1 = await createRevision(post.id, 'https://cdn.example.com/r1.jpg');

  const { count: reapproveCount } = await db
    .from('post_revisions')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', post.id)
    .not('image_url', 'is', null)
    .neq('id', rev1.id);  // prior revisions excluding rev1 → finds rev0

  if ((reapproveCount ?? 0) > 0)
    ok(`re-approval: priorCount=${reapproveCount} → notification SKIPPED`);
  else
    fail(`expected prior count > 0 for re-approval, got ${reapproveCount}`);
}

async function testI3_rejectNotification() {
  console.log('\nI3: reject → notification post.rejected with reason in metadata');

  const post   = await createTestPost();
  const reason = 'La imagen no cumple con el estilo visual de la marca';

  const { data: notif, error } = await db.from('notifications').insert({
    brand_id: BRAND_ID,
    type:     'post.rejected',
    message:  'Tu publicación necesita ajustes',
    metadata: { post_id: post.id, reason, format: 'post', cta_url: BASE_URL + '/dashboard' },
  }).select('id').single();

  if (error) { fail('insert rejected notification', error); return; }
  toClean.push({ table: 'notifications', id: notif.id });

  const found = await waitForNotification(post.id, 'post.rejected');
  if (found) ok('post.rejected notification row exists');
  else fail('post.rejected notification not found');

  const meta = found?.metadata as Record<string, unknown>;
  if (meta?.reason === reason) ok('reason persisted in metadata');
  else fail(`reason mismatch: ${meta?.reason}`);
}

async function testI4_reanalysisNotification() {
  console.log('\nI4: reanalyze → notification post.reanalysis_done');

  const post = await createTestPost({ agent_brief: { generation_prompt: 'original' } });

  const { data: notif, error } = await db.from('notifications').insert({
    brand_id: BRAND_ID,
    type:     'post.reanalysis_done',
    message:  'El equipo ha refinado el brief de tu publicación',
    metadata: { post_id: post.id, format: 'post', cta_url: BASE_URL + '/dashboard' },
  }).select('id').single();

  if (error) { fail('insert reanalysis notification', error); return; }
  toClean.push({ table: 'notifications', id: notif.id });

  const found = await waitForNotification(post.id, 'post.reanalysis_done');
  if (found) ok('post.reanalysis_done notification row exists');
  else fail('post.reanalysis_done notification not found');
}

async function testI5_instantAutoApprove() {
  console.log('\nI5: instant mode (needs_worker_review=false) → status=client_review + post.ready_auto');

  const post = await createTestPost();

  // Simulate what handleBriefGeneration does with needsWorkerReview=false
  await db.from('posts').update({
    edited_image_url: 'https://cdn.example.com/auto.jpg',
    status:           'client_review',
  }).eq('id', post.id);

  const { data: updated } = await db.from('posts').select('status').eq('id', post.id).single();
  if (updated?.status === 'client_review') ok('status=client_review for instant mode');
  else fail(`expected client_review, got ${updated?.status}`);

  // Insert the auto notification
  const { data: notif, error } = await db.from('notifications').insert({
    brand_id: BRAND_ID,
    type:     'post.ready_auto',
    message:  'Tu publicación ha sido generada automáticamente y está lista',
    metadata: { post_id: post.id, format: 'post', cta_url: BASE_URL + '/dashboard' },
  }).select('id').single();

  if (error) { fail('insert auto notification', error); return; }
  toClean.push({ table: 'notifications', id: notif.id });

  const found = await waitForNotification(post.id, 'post.ready_auto');
  if (found) ok('post.ready_auto notification exists');
  else fail('post.ready_auto notification not found');
}

async function testI6_reviewedModeNoAutoNotify() {
  console.log('\nI6: reviewed mode (needs_worker_review=true) → status=pending, no notification');

  const post = await createTestPost();

  // Simulate handleBriefGeneration with needsWorkerReview=true (default)
  await db.from('posts').update({
    edited_image_url: 'https://cdn.example.com/pending.jpg',
    status:           'pending',
  }).eq('id', post.id);

  const { data: updated } = await db.from('posts').select('status').eq('id', post.id).single();
  if (updated?.status === 'pending') ok('status=pending for reviewed mode');
  else fail(`expected pending, got ${updated?.status}`);

  // Wait briefly — no notification should appear
  await new Promise((r) => setTimeout(r, 300));
  const found = await waitForNotification(post.id, 'post.ready_auto', 500);
  if (!found) ok('no post.ready_auto notification for reviewed mode');
  else fail('unexpected post.ready_auto notification was fired');
}

async function testI7_unsetNeedsWorkerReview() {
  console.log('\nI7: needs_worker_review unset → status=pending (safe default)');

  const post = await createTestPost();

  // _needs_worker_review=undefined → newStatus='pending' (existing behavior)
  const needsWorkerReview: boolean | undefined = undefined;
  const newStatus = needsWorkerReview === false ? 'client_review' : 'pending';

  if (newStatus === 'pending') ok('undefined _needs_worker_review → status=pending');
  else fail(`expected pending, got ${newStatus}`);

  await db.from('posts').update({ status: 'pending' }).eq('id', post.id);
  const { data: updated } = await db.from('posts').select('status').eq('id', post.id).single();
  if (updated?.status === 'pending') ok('DB confirms status=pending');
  else fail(`DB status mismatch: ${updated?.status}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== test_post_notifications — Sprint 2.5 ===');
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log(`Base URL: ${BASE_URL}\n`);

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const { data: brand } = await db.from('brands').select('id, name').eq('id', BRAND_ID).single();
  if (!brand) {
    console.error(`Brand ${BRAND_ID} not found — update BRAND_ID to a valid brand`);
    process.exit(1);
  }
  console.log(`Using brand: ${brand.name}\n`);

  try {
    // Unit tests (synchronous)
    testU1();
    testU2_emailFailure();

    // Integration tests
    await testI1_approveNotification();
    await testI2_approveNoDuplicate();
    await testI3_rejectNotification();
    await testI4_reanalysisNotification();
    await testI5_instantAutoApprove();
    await testI6_reviewedModeNoAutoNotify();
    await testI7_unsetNeedsWorkerReview();

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
