// run_migration_sprint7.ts — Apply retouch_requests migration

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
        (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (val && !(key in process.env)) process.env[key] = val;
  }
}

async function main() {
  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secret) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const sql = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260420_create_retouch_requests.sql'),
    'utf-8',
  );

  // Split on ; to run each statement separately (Supabase REST doesn't support multi-statement)
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));

  console.log(`Running ${statements.length} statements...`);

  for (const stmt of statements) {
    const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        apikey:          secret,
        Authorization:   `Bearer ${secret}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ sql: stmt + ';' }),
    });

    if (!res.ok) {
      // Try Supabase SQL endpoint directly
      const errText = await res.text();
      // Most Supabase projects expose /rest/v1/ but not raw SQL — fall back to pg-meta
      console.warn(`Statement via rpc failed (${res.status}): ${errText.slice(0, 200)}`);
      console.log('Trying pg-meta endpoint...');

      const res2 = await fetch(`${url.replace('https://', 'https://').replace('.supabase.co', '.supabase.co')}/pg/query`, {
        method: 'POST',
        headers: {
          apikey:         secret,
          Authorization:  `Bearer ${secret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: stmt + ';' }),
      });
      if (!res2.ok) {
        const err2 = await res2.text();
        console.warn(`pg-meta also failed: ${err2.slice(0, 200)}`);
      } else {
        console.log('OK via pg-meta');
      }
    } else {
      console.log('OK');
    }
  }

  console.log('\nMigration done. If errors appeared, apply the SQL manually in the Supabase dashboard:');
  console.log('supabase/migrations/20260420_create_retouch_requests.sql');
}

main().catch(console.error);
