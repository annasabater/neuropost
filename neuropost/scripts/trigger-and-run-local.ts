/* eslint-disable no-console */
// Encolar y procesar generate_ideas en la misma invocación para capturar el
// log [generate-ideas] localmente antes que el cron de Vercel claim el job.

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvLocal();

async function main() {
  await import('../src/lib/agents/handlers');
  const { orchestrateJob } = await import('../src/lib/agents/orchestrator');
  const { runOnce } = await import('../src/lib/agents/runner');

  const BRAND_ID = 'e8dc77ef-8371-4765-a90c-c7108733f791';
  console.log('---ENQUEUE---');
  const res = await orchestrateJob({
    brand_id:     BRAND_ID,
    agent_type:   'strategy',
    action:       'generate_ideas',
    input:        { count: 5 },
    requested_by: 'system',
    priority:     90,
  });
  console.log(JSON.stringify(res, null, 2));

  console.log('---RUN ONCE (local claim + process)---');
  const result = await runOnce(5);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
