/* eslint-disable no-console */
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
  const { createAdminClient } = await import('../src/lib/supabase');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  const ids = ['bc4a1660-33fb-44b7-8382-76a99a5f6e71', 'd82b2e66-5a7b-4c12-8429-fc67080ee261'];
  const { data: jobs } = await db
    .from('agent_jobs')
    .select('id, agent_type, action, status, attempts, error, started_at, finished_at, created_at, claimed_by')
    .in('id', ids);
  console.log('---JOBS---');
  console.log(JSON.stringify(jobs, null, 2));

  for (const id of ids) {
    const { data: outputs } = await db
      .from('agent_outputs')
      .select('id, kind, model, created_at, payload')
      .eq('job_id', id);
    console.log(`---OUTPUTS for ${id}---`);
    console.log(JSON.stringify(outputs, null, 2));
  }
}
main().catch(e => { console.error(e); process.exit(1); });
