// Dispara planWeekHandler para SportArea y NO limpia.
// El weekly_plan queda en la BD para seguir el E2E en la UI.
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

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
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvLocal();

import { planWeekHandler } from '../src/lib/agents/strategy/plan-week';

async function main() {
  const job = {
    id: 'e2e-' + Date.now(),
    brand_id: 'e8dc77ef-8371-4765-a90c-c7108733f791',
    agent_type: 'strategy' as const,
    action: 'plan_week',
    input: { count: 3 },
    priority: 50,
    status: 'pending' as const,
    created_at: new Date().toISOString(),
    attempts: 0,
  };

  console.log('Disparando planWeekHandler para SportArea...');
  const result = await planWeekHandler(job as any);
  console.log('\n=== RESULTADO ===');
  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
