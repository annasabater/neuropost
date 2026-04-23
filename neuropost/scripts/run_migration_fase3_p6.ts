/* eslint-disable no-console */
// Apply the Phase 3 P6 migration (UNIQUE INDEX + create_weekly_plan_atomic RPC).
//
// Run: npx tsx --tsconfig tsconfig.json scripts/run_migration_fase3_p6.ts
//
// If automatic application fails, apply manually in the Supabase SQL editor:
//   supabase/migrations/20260423_planning_fixes_fase3_atomic_create_plan.sql

import { readFileSync, existsSync } from 'node:fs';
import { resolve }                  from 'node:path';

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const eq = line.indexOf('='); if (eq === -1) continue;
    const k = line.slice(0, eq).trim(); let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

const MIGRATION_PATH = resolve(
  process.cwd(),
  'supabase/migrations/20260423_planning_fixes_fase3_atomic_create_plan.sql',
);

async function applyStatement(sql: string): Promise<boolean> {
  // Try exec_sql RPC (requires function to exist in DB)
  const r1 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method:  'POST',
    headers: {
      apikey:          SERVICE_KEY,
      Authorization:   `Bearer ${SERVICE_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ sql: sql + ';' }),
  });
  if (r1.ok) return true;

  // Fallback: pg-meta query endpoint
  const r2 = await fetch(`${SUPABASE_URL}/pg/query`, {
    method:  'POST',
    headers: {
      apikey:         SERVICE_KEY,
      Authorization:  `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql + ';' }),
  });
  if (r2.ok) return true;

  const err = await r2.text().catch(() => '(unreadable)');
  console.warn(`  Both endpoints failed. Last error: ${err.slice(0, 200)}`);
  return false;
}

async function main() {
  console.log('Applying migration: 20260423_planning_fixes_fase3_atomic_create_plan.sql\n');

  const rawSql = readFileSync(MIGRATION_PATH, 'utf-8');

  // Split on lines that end a statement (ending with ';' after trimming), but
  // preserve function bodies ($$...$$). Simple heuristic: split on lines that
  // are exactly ';' (end of DO/CREATE FUNCTION blocks) OR split on ';' outside
  // of $$ blocks.
  const statements: string[] = [];
  let current = '';
  let inDollar = false;

  for (const line of rawSql.split('\n')) {
    if (line.includes('$$')) {
      inDollar = !inDollar;
    }
    current += line + '\n';
    if (!inDollar && line.trimEnd().endsWith(';')) {
      const s = current.trim().replace(/;$/, '').trim();
      if (s && !s.startsWith('--')) statements.push(s);
      current = '';
    }
  }
  if (current.trim()) {
    const s = current.trim().replace(/;$/, '').trim();
    if (s && !s.startsWith('--')) statements.push(s);
  }

  let ok = 0;
  let fail = 0;
  for (const stmt of statements) {
    const preview = stmt.replace(/\s+/g, ' ').slice(0, 80);
    process.stdout.write(`  ${preview}… `);
    const success = await applyStatement(stmt);
    if (success) { console.log('OK'); ok++; }
    else          { console.log('FAILED'); fail++; }
  }

  console.log(`\n${ok} statements OK, ${fail} failed.`);
  if (fail > 0) {
    console.log('\nApply the migration manually via Supabase SQL editor:');
    console.log('  supabase/migrations/20260423_planning_fixes_fase3_atomic_create_plan.sql');
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
