// =============================================================================
// NeuroPost — Local runner tick
//
// Usage:
//   npx tsx scripts/run-once-local.ts
//
// What it does:
//   Loads .env.local, then calls runOnce(5) which claims up to 5 pending
//   agent_jobs from Supabase, processes them, and does orphan recovery.
//   Prints the RunnerResult as JSON at the end. All stdout from handlers
//   (including [generate-ideas] prompt_chars log) is captured.
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

loadEnvLocal();

async function main() {
  // Register handlers (side-effect import)
  await import('../src/lib/agents/handlers');

  const { runOnce } = await import('../src/lib/agents/runner');

  const result = await runOnce(5);
  console.log('---RUNNER RESULT---');
  console.log(JSON.stringify(result, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
