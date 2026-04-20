// test_sprint6.ts — Sprint 6: proposal-hook tests (normal, partial, idempotent)

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  const raw = readFileSync(envPath, 'utf-8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (val && !(key in process.env)) process.env[key] = val;
  }
  console.log('[env] cargadas desde .env.local');
} else {
  console.warn('[env] .env.local NO encontrado en', envPath);
}

console.log('ENV check:');
console.log('  NEXT_PUBLIC_SUPABASE_URL  :', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING');
console.log('  SUPABASE_SERVICE_ROLE_KEY :', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING');
console.log('');

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: Faltan variables de entorno. Rellena NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const BRAND_ID = 'e8dc77ef-8371-4765-a90c-c7108733f791';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getDb(): Promise<any> {
  const { createAdminClient } = await import('../src/lib/supabase');
  return createAdminClient();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createProducingPlan(db: any, ideaCount: number): Promise<{
  planId:   string;
  ideaIds:  string[];
  postIds:  string[];
}> {
  // Create real agent_job for FK
  const { data: job, error: jobErr } = await db
    .from('agent_jobs')
    .insert({ brand_id: BRAND_ID, agent_type: 'strategy', action: 'plan_week', input: {}, priority: 50, status: 'pending', attempts: 0 })
    .select()
    .single();
  if (jobErr || !job) throw new Error(`agent_job insert failed: ${jobErr?.message}`);

  // Unique week_start to avoid constraint collision
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() + ((8 - weekStart.getDay()) % 7 || 7) + Math.floor(Math.random() * 52) * 7);
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const { data: plan, error: planErr } = await db
    .from('weekly_plans')
    .insert({
      brand_id:      BRAND_ID,
      parent_job_id: job.id,
      week_start:    weekStartStr,
      status:        'producing',
    })
    .select()
    .single();
  if (planErr || !plan) throw new Error(`weekly_plan insert failed: ${planErr?.message}`);

  const ideaIds: string[] = [];
  for (let i = 0; i < ideaCount; i++) {
    const { data: idea, error: ideaErr } = await db
      .from('content_ideas')
      .insert({
        week_id:    plan.id,
        brand_id:   BRAND_ID,
        position:   i,
        format:     'image',
        angle:      `Test idea ${i + 1}`,
        copy_draft: `Copy de prueba ${i + 1}`,
        status:     'in_production',
      })
      .select()
      .single();
    if (ideaErr || !idea) throw new Error(`content_idea insert failed: ${ideaErr?.message}`);
    ideaIds.push(idea.id as string);
  }

  // Create fake posts to use as production outputs
  const postIds: string[] = [];
  for (let i = 0; i < ideaCount; i++) {
    const { data: post, error: postErr } = await db
      .from('posts')
      .insert({
        brand_id: BRAND_ID,
        status:   'approved',
        caption:  `TEST POST sprint6 idea ${i + 1}`,
        format:   'image',
      })
      .select()
      .single();
    if (postErr || !post) throw new Error(`post insert failed: ${postErr?.message}`);
    postIds.push(post.id as string);
  }

  return { planId: plan.id as string, ideaIds, postIds };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cleanup(db: any, planId: string, postIds: string[]): Promise<void> {
  await db.from('content_ideas').delete().eq('week_id', planId);
  await db.from('weekly_plans').delete().eq('id', planId);
  if (postIds.length > 0) await db.from('posts').delete().in('id', postIds);
  console.log('[cleanup] planId:', planId, 'posts:', postIds.length);
}

// ─── Test 1: all ideas approved → plan becomes calendar_ready ─────────────────

async function test1_fullApproval() {
  console.log('\n=== TEST 1: Aprobación completa → calendar_ready ===');
  const db = await getDb();
  const { planId, ideaIds, postIds } = await createProducingPlan(db, 2);
  // Add one rejected idea (should not block completion)
  const { data: rejected } = await db
    .from('content_ideas')
    .insert({ week_id: planId, brand_id: BRAND_ID, position: 99, format: 'image', angle: 'Rejected idea', status: 'client_rejected' })
    .select()
    .single();

  try {
    const { onProposalApproved } = await import('../src/lib/planning/proposal-hooks');

    // Approve all producible ideas sequentially
    for (let i = 0; i < ideaIds.length; i++) {
      await onProposalApproved({
        proposal_id:     `fake-proposal-${Date.now()}-${i}`,
        content_idea_id: ideaIds[i],
        post_id:         postIds[i],
      });
    }

    // Verify
    const { data: plan } = await db.from('weekly_plans').select('status').eq('id', planId).single();
    const { data: ideas } = await db.from('content_ideas').select('id, status').eq('week_id', planId);
    const { data: notifs } = await db.from('notifications').select('id').eq('type', 'weekly_plan.final_calendar_ready').order('created_at', { ascending: false }).limit(1);

    const planOk  = (plan as { status: string } | null)?.status === 'calendar_ready';
    const ideasOk = (ideas as { id: string; status: string }[]).filter(i => i.status === 'produced').length === ideaIds.length;
    const notifOk = notifs && (notifs as unknown[]).length > 0;

    console.log('[1]', planOk  ? '✓ plan = calendar_ready' : `✗ plan status = ${(plan as { status: string } | null)?.status}`);
    console.log('[1]', ideasOk ? '✓ ideas producibles = produced' : '✗ ideas not produced');
    console.log('[1]', notifOk ? '✓ notification insertada' : '✗ notification no encontrada (email puede haber fallado por Gmail en dev)');
  } finally {
    if (rejected?.id) postIds.push(); // just cleanup the extra idea via week delete
    await cleanup(db, planId, postIds);
  }
}

// ─── Test 2: partial approval does NOT close the plan ─────────────────────────

async function test2_partialApproval() {
  console.log('\n=== TEST 2: Aprobación parcial → plan sigue en producing ===');
  const db = await getDb();
  const { planId, ideaIds, postIds } = await createProducingPlan(db, 3);

  try {
    const { onProposalApproved } = await import('../src/lib/planning/proposal-hooks');

    // Only approve the first idea
    await onProposalApproved({
      proposal_id:     `fake-proposal-${Date.now()}`,
      content_idea_id: ideaIds[0],
      post_id:         postIds[0],
    });

    const { data: plan }  = await db.from('weekly_plans').select('status').eq('id', planId).single();
    const { data: idea0 } = await db.from('content_ideas').select('status, post_id').eq('id', ideaIds[0]).single();

    const planOk  = (plan as { status: string } | null)?.status === 'producing';
    const ideaOk  = (idea0 as { status: string; post_id: string } | null)?.status === 'produced';

    console.log('[2]', planOk ? '✓ plan sigue en producing' : `✗ plan status = ${(plan as { status: string } | null)?.status}`);
    console.log('[2]', ideaOk ? '✓ idea[0] = produced' : '✗ idea[0] no producida');
  } finally {
    await cleanup(db, planId, postIds);
  }
}

// ─── Test 3: idempotency — double hook call doesn't break anything ─────────────

async function test3_idempotency() {
  console.log('\n=== TEST 3: Idempotencia — doble hook no rompe nada ===');
  const db = await getDb();
  const { planId, ideaIds, postIds } = await createProducingPlan(db, 1);

  try {
    const { onProposalApproved } = await import('../src/lib/planning/proposal-hooks');

    // First call
    await onProposalApproved({
      proposal_id:     `fake-proposal-${Date.now()}`,
      content_idea_id: ideaIds[0],
      post_id:         postIds[0],
    });

    // Second call (duplicate)
    await onProposalApproved({
      proposal_id:     `fake-proposal-${Date.now()}-dup`,
      content_idea_id: ideaIds[0],
      post_id:         postIds[0],
    });

    const { data: idea } = await db.from('content_ideas').select('status').eq('id', ideaIds[0]).single();
    const ideaOk = (idea as { status: string } | null)?.status === 'produced';
    console.log('[3]', ideaOk ? '✓ idea sigue en produced (sin duplicado)' : '✗ estado inesperado');
    console.log('[3] ✓ Sin excepción en doble llamada');
  } finally {
    await cleanup(db, planId, postIds);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await test1_fullApproval();
  await test2_partialApproval();
  await test3_idempotency();
  console.log('\n=== FIN TESTS SPRINT 6 ===');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
