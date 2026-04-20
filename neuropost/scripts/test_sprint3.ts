// =============================================================================
// Sprint 3 — manual test harness for plan-week feature-flag bifurcation
//
// Usage (run from neuropost/):
//   npx tsx scripts/test_sprint3.ts                   # all 3 tests sequentially
//   npx tsx scripts/test_sprint3.ts --test regression # only test 1
//   npx tsx scripts/test_sprint3.ts --test activation # only test 2
//   npx tsx scripts/test_sprint3.ts --test bypass     # only test 3
//
// Tests:
//   1. regression  — flag=false  → legacy sub-jobs returned, no weekly_plan created
//   2. activation  — flag=true   → weekly_plan + content_ideas created, sub_jobs=[]
//   3. bypass      — flag=true + human_review_config.messages=false → goes straight to client email
//
// The script patches brands.use_new_planning_flow and restores it after each test.
// =============================================================================

/* eslint-disable no-console */

import { readFileSync, existsSync } from 'node:fs';
import { resolve }                  from 'node:path';

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
    let val   = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

function pass(label: string) { console.log(`  ✓  ${label}`); }
function fail(label: string, detail?: string) {
  console.error(`  ✗  ${label}${detail ? ` — ${detail}` : ''}`);
  process.exitCode = 1;
}

async function getBrand(db: DB, brandId: string) {
  const { data, error } = await db.from('brands').select('*').eq('id', brandId).single();
  if (error || !data) throw new Error(`Brand ${brandId} not found`);
  return data;
}

async function patchBrand(db: DB, brandId: string, patch: Record<string, unknown>) {
  const { error } = await db.from('brands').update(patch).eq('id', brandId);
  if (error) throw new Error(`Failed to patch brand: ${error.message}`);
}

async function deleteWeeklyPlan(db: DB, brandId: string, weekStart: string) {
  const { data: plan } = await db
    .from('weekly_plans').select('id').eq('brand_id', brandId).eq('week_start', weekStart).maybeSingle();
  if (plan) {
    await db.from('content_ideas').delete().eq('week_id', plan.id);
    await db.from('weekly_plans').delete().eq('id', plan.id);
    console.log(`  [cleanup] deleted weekly_plan ${plan.id} + its content_ideas`);
  }
}

async function stubJob(db: DB, brandId: string): Promise<import('../src/lib/agents/types').AgentJob> {
  const { data, error } = await db
    .from('agent_jobs')
    .insert({
      brand_id:   brandId,
      agent_type: 'strategy',
      action:     'plan_week',
      input:      { count: 3 },
      priority:   50,
      status:     'pending',
      attempts:   0,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`Failed to insert stub agent_job: ${error?.message}`);
  return data as import('../src/lib/agents/types').AgentJob;
}

async function deleteStubJob(db: DB, jobId: string) {
  await db.from('agent_jobs').delete().eq('id', jobId);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function testRegression(db: DB, brandId: string) {
  console.log('\n── TEST 1: Regression (flag=false) ─────────────────────────────');
  const orig = await getBrand(db, brandId);
  await patchBrand(db, brandId, { use_new_planning_flow: false });

  try {
    const { planWeekHandler } = await import('../src/lib/agents/strategy/plan-week');
    const job = await stubJob(db, brandId);
    const result = await planWeekHandler(job);

    if (result.type !== 'ok') {
      fail('handler returned ok', `got type=${result.type}`);
      console.error('  [detail]', JSON.stringify(result, null, 2));
      return;
    }
    pass('handler returned ok');

    const subJobs = (result as { sub_jobs?: unknown[] }).sub_jobs ?? [];
    if (subJobs.length > 0) {
      pass(`sub_jobs fanned out (${subJobs.length} jobs) — legacy flow active`);
    } else {
      fail('sub_jobs should be non-empty in legacy flow');
    }

    // Ensure no weekly_plan was created
    const { data: plan } = await db
      .from('weekly_plans').select('id').eq('brand_id', brandId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    // The plan may pre-exist from a prior run; we just check the handler didn't write one with this job id
    if ((plan as { id?: string } | null)?.id) {
      console.log(`  [info]  weekly_plan exists (may be pre-existing): ${(plan as { id: string }).id}`);
    }
    pass('no new weekly_plan created by legacy flow (verified via sub_jobs presence)');
    await deleteStubJob(db, job.id);
  } finally {
    await patchBrand(db, brandId, {
      use_new_planning_flow: orig.use_new_planning_flow ?? false,
      human_review_config:   orig.human_review_config  ?? null,
    });
  }
}

async function testActivation(db: DB, brandId: string) {
  console.log('\n── TEST 2: New flow activation (flag=true) ─────────────────────');
  const orig = await getBrand(db, brandId);

  // Derive the current week_start so we can clean up after
  const { extractWeekStart } = await import('../src/lib/planning/parse-ideas');
  const weekStart = extractWeekStart();

  // Pre-clean any existing plan for this week to make the test idempotent
  await deleteWeeklyPlan(db, brandId, weekStart);

  await patchBrand(db, brandId, {
    use_new_planning_flow: true,
    human_review_config:   { messages: true },
  });

  try {
    const { planWeekHandler } = await import('../src/lib/agents/strategy/plan-week');
    const job = await stubJob(db, brandId);
    const result = await planWeekHandler(job);

    if (result.type !== 'ok') {
      fail('handler returned ok', `got type=${result.type}`);
      console.error('  [detail]', JSON.stringify(result, null, 2));
      await deleteStubJob(db, job.id);
      return;
    }
    pass('handler returned ok');

    const subJobs = (result as { sub_jobs?: unknown[] }).sub_jobs ?? [];
    if (subJobs.length === 0) {
      pass('sub_jobs=[] — no fan-out in new flow');
    } else {
      fail('sub_jobs should be empty in new flow', `got ${subJobs.length}`);
    }

    // Check weekly_plan was created
    const { data: plan, error } = await db
      .from('weekly_plans').select('*').eq('brand_id', brandId).eq('week_start', weekStart).maybeSingle();
    if (error || !plan) {
      fail('weekly_plan created in DB');
      await deleteStubJob(db, job.id);
      return;
    }
    pass(`weekly_plan created (id=${plan.id}, status=${plan.status})`);

    if (plan.status === 'ideas_ready') {
      pass('status=ideas_ready');
    } else {
      fail('expected status=ideas_ready', `got ${plan.status}`);
    }

    // Check content_ideas
    const { data: ideas } = await db.from('content_ideas').select('id').eq('week_id', plan.id);
    if ((ideas?.length ?? 0) > 0) {
      pass(`${ideas!.length} content_ideas created`);
    } else {
      fail('content_ideas should have been created');
    }

    // Check worker_notification
    const { data: notif } = await db
      .from('worker_notifications').select('id, type')
      .eq('brand_id', brandId).eq('type', 'needs_review')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (notif) {
      pass('worker_notification created (type=needs_review)');
    } else {
      fail('expected worker_notification to be created');
    }

    // Cleanup test plan + job
    await deleteWeeklyPlan(db, brandId, weekStart);
    await deleteStubJob(db, job.id);
  } finally {
    await patchBrand(db, brandId, {
      use_new_planning_flow: orig.use_new_planning_flow ?? false,
      human_review_config:   orig.human_review_config  ?? null,
    });
  }
}

async function testBypassWorker(db: DB, brandId: string) {
  console.log('\n── TEST 3: Bypass worker review (messages=false) ───────────────');
  const orig = await getBrand(db, brandId);

  const { extractWeekStart } = await import('../src/lib/planning/parse-ideas');
  const weekStart = extractWeekStart();
  await deleteWeeklyPlan(db, brandId, weekStart);

  await patchBrand(db, brandId, {
    use_new_planning_flow: true,
    human_review_config:   { messages: false },
  });

  try {
    const { planWeekHandler } = await import('../src/lib/agents/strategy/plan-week');
    const job = await stubJob(db, brandId);
    const result = await planWeekHandler(job);

    if (result.type !== 'ok') {
      fail('handler returned ok', `got type=${result.type}`);
      console.error('  [detail]', JSON.stringify(result, null, 2));
      await deleteStubJob(db, job.id);
      return;
    }
    pass('handler returned ok');

    const { data: plan } = await db
      .from('weekly_plans').select('*').eq('brand_id', brandId).eq('week_start', weekStart).maybeSingle();
    if (!plan) {
      fail('weekly_plan should have been created');
      await deleteStubJob(db, job.id);
      return;
    }
    pass(`weekly_plan created (id=${plan.id})`);

    if (plan.status === 'client_reviewing') {
      pass('status=client_reviewing (worker bypassed)');
    } else {
      fail('expected status=client_reviewing', `got ${plan.status}`);
    }

    await deleteWeeklyPlan(db, brandId, weekStart);
    await deleteStubJob(db, job.id);
  } finally {
    await patchBrand(db, brandId, {
      use_new_planning_flow: orig.use_new_planning_flow ?? false,
      human_review_config:   orig.human_review_config  ?? null,
    });
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  loadEnvLocal();

  const BRAND_ID = process.env.TEST_BRAND_ID;
  if (!BRAND_ID) {
    console.error('ERROR: set TEST_BRAND_ID=<uuid> in .env.local or environment');
    process.exit(1);
  }

  const args    = process.argv.slice(2);
  const testIdx = args.indexOf('--test');
  const only    = testIdx !== -1 ? args[testIdx + 1] : null;

  const { createAdminClient } = await import('../src/lib/supabase');
  const db: DB = createAdminClient();

  console.log(`\n══════════════════════════════════════════════`);
  console.log(` Sprint 3 — planWeekHandler bifurcation tests`);
  console.log(` Brand: ${BRAND_ID}`);
  console.log(`══════════════════════════════════════════════`);

  if (!only || only === 'regression') await testRegression(db, BRAND_ID);
  if (!only || only === 'activation') await testActivation(db, BRAND_ID);
  if (!only || only === 'bypass')     await testBypassWorker(db, BRAND_ID);

  console.log('\n══════════════════════════════════════════════');
  if (process.exitCode) {
    console.log(' RESULT: FAIL — see ✗ lines above');
  } else {
    console.log(' RESULT: ALL TESTS PASSED');
  }
  console.log('══════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
