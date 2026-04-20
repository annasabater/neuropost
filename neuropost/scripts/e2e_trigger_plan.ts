// e2e_trigger_plan.ts — Sprint 4 E2E: dispara planWeekHandler y NO limpia

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
} else {
  console.log('[env] .env.local NO encontrado en', envPath);
}

console.log('ENV check:');
console.log('  ANTHROPIC_API_KEY              :', process.env.ANTHROPIC_API_KEY ? 'SET' : 'MISSING');
console.log('  RESEND_API_KEY                 :', process.env.RESEND_API_KEY ? 'SET' : 'MISSING');
console.log('  NEXT_PUBLIC_SUPABASE_URL       :', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING');
console.log('  SUPABASE_SERVICE_ROLE_KEY      :', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING');
console.log('');

async function main() {
  const mod = await import('../src/lib/agents/strategy/plan-week');
  const planWeekHandler = mod.planWeekHandler;

  if (typeof planWeekHandler !== 'function') {
    console.error('planWeekHandler no es función. Exports:', Object.keys(mod));
    process.exit(1);
  }

  const BRAND_ID = 'e8dc77ef-8371-4765-a90c-c7108733f791';

  // Insertar un agent_job real para obtener un UUID válido (FK en weekly_plans.parent_job_id)
  const { createAdminClient } = await import('../src/lib/supabase');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const { data: jobRow, error: jobErr } = await db
    .from('agent_jobs')
    .insert({ brand_id: BRAND_ID, agent_type: 'strategy', action: 'plan_week', input: { count: 3 }, priority: 50, status: 'pending', attempts: 0 })
    .select()
    .single();
  if (jobErr || !jobRow) { console.error('No se pudo insertar agent_job:', jobErr?.message); process.exit(1); }
  console.log('[e2e] agent_job insertado:', jobRow.id);

  const job = { ...jobRow };

  console.log('Disparando planWeekHandler para SportArea...\n');
  const result = await planWeekHandler(job);
  console.log('\n=== RESULTADO ===');
  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error('Error capturado:', err);
  process.exit(1);
});