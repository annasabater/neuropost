// test_reminders.ts — Sprint 5: tests A (day 2), B (auto-approve day 6), C (idempotency)

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
    if (!(key in process.env)) process.env[key] = val;
  }
  console.log('[env] cargadas desde .env.local');
}

console.log('ENV check:');
console.log('  RESEND_API_KEY             :', process.env.RESEND_API_KEY ? 'SET' : 'MISSING');
console.log('  NEXT_PUBLIC_SUPABASE_URL   :', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING');
console.log('  SUPABASE_SERVICE_ROLE_KEY  :', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING');
console.log('');

const BRAND_ID = 'e8dc77ef-8371-4765-a90c-c7108733f791';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getDb(): Promise<any> {
  const { createAdminClient } = await import('../src/lib/supabase');
  return createAdminClient();
}

async function createTestPlan(db: Awaited<ReturnType<typeof getDb>>, daysSinceCreated: number, remindersSent: {
  reminder_2?: boolean;
  reminder_4?: boolean;
}, weekOffsetWeeks = 0): Promise<string> {
  const sentAt = new Date(Date.now() - daysSinceCreated * 24 * 60 * 60 * 1000).toISOString();

  // Create a real agent_job for the FK
  const { data: job, error: jobErr } = await db
    .from('agent_jobs')
    .insert({ brand_id: BRAND_ID, agent_type: 'strategy', action: 'plan_week', input: {}, priority: 50, status: 'pending', attempts: 0 })
    .select()
    .single();
  if (jobErr || !job) throw new Error(`No se pudo insertar agent_job: ${jobErr?.message}`);

  // week_start = next Monday from today + weekOffsetWeeks weeks (each test uses a different week)
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() + ((8 - weekStart.getDay()) % 7 || 7) + weekOffsetWeeks * 7);
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const insertPayload: Record<string, unknown> = {
    brand_id:           BRAND_ID,
    parent_job_id:      job.id,
    week_start:         weekStartStr,
    status:             'client_reviewing',
    sent_to_client_at:  sentAt,
    auto_approved:      false,
  };
  if (remindersSent.reminder_2) insertPayload.reminder_2_sent_at = new Date(Date.now() - 1000).toISOString();
  if (remindersSent.reminder_4) insertPayload.reminder_4_sent_at = new Date(Date.now() - 1000).toISOString();

  const { data: plan, error: planErr } = await db
    .from('weekly_plans')
    .insert(insertPayload)
    .select()
    .single();
  if (planErr || !plan) throw new Error(`No se pudo insertar weekly_plan: ${planErr?.message}`);

  // Insert at least one pending content_idea
  const { error: ideaErr } = await db.from('content_ideas').insert({
    week_id:  plan.id,
    brand_id: BRAND_ID,
    position: 0,
    format:   'image',
    angle:    'Test idea para reminder',
    copy_draft: 'Copy de prueba',
    status:   'pending',
  });
  if (ideaErr) throw new Error(`No se pudo insertar content_idea: ${ideaErr.message}`);

  return plan.id as string;
}

async function cleanup(db: Awaited<ReturnType<typeof getDb>>, planIds: string[]): Promise<void> {
  for (const id of planIds) {
    await db.from('content_ideas').delete().eq('week_id', id);
    await db.from('weekly_plans').delete().eq('id', id);
  }
  console.log('[cleanup] Planes eliminados:', planIds);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function testA_day2Reminder(db: Awaited<ReturnType<typeof getDb>>): Promise<string> {
  console.log('\n=== TEST A: Day-2 reminder ===');
  const planId = await createTestPlan(db, 2.5, {}, 1); // week +1, 2.5 days ago, no reminders sent
  console.log('[A] Plan creado:', planId);

  const { processReminders } = await import('../src/lib/agents/handlers/reminders');
  const result = await processReminders();
  console.log('[A] Resultado processReminders:', result);

  const { data: plan } = await db.from('weekly_plans').select('reminder_2_sent_at').eq('id', planId).single();
  const passed = plan?.reminder_2_sent_at != null;
  console.log('[A]', passed ? '✓ PASS — reminder_2_sent_at actualizado' : '✗ FAIL — reminder_2_sent_at sigue NULL');
  if (result.sent > 0) console.log('[A] ✓ sent counter incrementado');

  return planId;
}

async function testB_autoApproveDay6(db: Awaited<ReturnType<typeof getDb>>): Promise<string> {
  console.log('\n=== TEST B: Auto-approve day 6 ===');
  const planId = await createTestPlan(db, 6.5, { reminder_2: true, reminder_4: true }, 2); // week +2, 6.5 days ago
  console.log('[B] Plan creado:', planId);

  const { processReminders } = await import('../src/lib/agents/handlers/reminders');
  const result = await processReminders();
  console.log('[B] Resultado processReminders:', result);

  const { data: plan } = await db.from('weekly_plans').select('status, auto_approved, auto_approved_at').eq('id', planId).single();
  const passed = plan?.status === 'producing' && plan?.auto_approved === true;
  console.log('[B]', passed ? '✓ PASS — plan en producing, auto_approved=true' : `✗ FAIL — status=${plan?.status as string}, auto_approved=${plan?.auto_approved as string}`);
  if (result.autoApproved > 0) console.log('[B] ✓ autoApproved counter incrementado');

  return planId;
}

async function testC_idempotency(db: Awaited<ReturnType<typeof getDb>>): Promise<string> {
  console.log('\n=== TEST C: Idempotency (no double send) ===');
  // reminder_2 already sent
  const planId = await createTestPlan(db, 2.5, { reminder_2: true }, 3); // week +3
  console.log('[C] Plan creado con reminder_2_sent_at ya establecido:', planId);

  const { processReminders } = await import('../src/lib/agents/handlers/reminders');
  const result = await processReminders();
  console.log('[C] Resultado processReminders:', result);

  const passed = result.skipped > 0 && result.sent === 0;
  console.log('[C]', passed ? '✓ PASS — skipped, no re-envío' : `✗ FAIL — sent=${result.sent}, skipped=${result.skipped}`);

  return planId;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const db = await getDb();

  let planId: string | undefined;

  // Test A
  try {
    planId = await testA_day2Reminder(db);
  } finally {
    if (planId) await cleanup(db, [planId]);
  }

  // Test B
  planId = undefined;
  try {
    planId = await testB_autoApproveDay6(db);
  } finally {
    if (planId) await cleanup(db, [planId]);
  }

  // Test C
  planId = undefined;
  try {
    planId = await testC_idempotency(db);
  } finally {
    if (planId) await cleanup(db, [planId]);
  }

  console.log('\n=== FIN TESTS SPRINT 5 ===');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
