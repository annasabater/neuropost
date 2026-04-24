// =============================================================================
// NeuroPost — Manual trigger for strategy:generate_ideas
//
// Usage:
//   npx tsx scripts/trigger-generate-ideas.ts
//
// What it does:
//   Enqueues a single strategy:generate_ideas job for SportArea via orchestrateJob
//   (same path the cron uses). The runner will pick it up on its next tick.
//
// Output:
//   { ok: true, jobs: [{ id: '<uuid>', status: 'pending' }] }  ← apunta el id.
// =============================================================================

/* eslint-disable no-console */

import { readFileSync, existsSync } from 'node:fs';
import { resolve }                  from 'node:path';

// ─── Load .env.local (mirrors existing scripts) ──────────────────────────────

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

// Imports AFTER env load so supabase/anthropic clients see the keys.
async function main() {
  const { orchestrateJob } = await import('../src/lib/agents/orchestrator');

  const BRAND_ID = 'e8dc77ef-8371-4765-a90c-c7108733f791'; // SportArea

  const res = await orchestrateJob({
    brand_id:     BRAND_ID,
    agent_type:   'strategy',
    action:       'generate_ideas',
    input:        { count: 5 },
    requested_by: 'system',
    priority:     90,
  });

  console.log(JSON.stringify(res, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
