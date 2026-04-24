#!/usr/bin/env npx tsx
// =============================================================================
// verify-phase0-schema.ts — Phase 0.A acceptance check
// =============================================================================
// Validates:
//   1. Every column declared in `schema.sql` for `public.brands` is present
//      in the live DB.
//   2. The migration `20260424_brands_schema_consolidation.sql` lists the
//      same set of columns that `schema.sql` adds over the initial block.
//   3. No reverse drift — no live column missing from `schema.sql`.
//
// Run: npx tsx --tsconfig tsconfig.json scripts/verify-phase0-schema.ts
// Exits with code 0 on pass, 1 on fail.

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

import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error('FAIL: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local');
  process.exit(1);
}

const db = createClient(URL, KEY, { auth: { persistSession: false } });

const ROOT = resolve(__dirname, '..');

function parseSchemaBrands(sql: string): string[] {
  const match = sql.match(/create\s+table\s+if\s+not\s+exists\s+public\.brands\s*\(([\s\S]*?)\n\)\s*;/i);
  if (!match) throw new Error('Could not find CREATE TABLE brands in schema.sql');
  const body = match[1];
  const cols: string[] = [];
  for (const raw of body.split('\n')) {
    const line = raw.replace(/--.*$/, '').replace(/,\s*$/, '').trim();
    if (!line) continue;
    if (/^(primary\s+key|unique|constraint|foreign\s+key|check)/i.test(line)) continue;
    const m = line.match(/^"?(\w+)"?\s+([a-z_\[\]\(\)0-9]+)/i);
    if (!m) continue;
    cols.push(m[1]);
  }
  return cols;
}

function parseMigrationAddColumns(sql: string): string[] {
  const cols: string[] = [];
  const re = /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+(\w+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) cols.push(m[1]);
  return cols;
}

interface CheckResult { name: string; passed: boolean; detail?: string; }
const results: CheckResult[] = [];
function check(name: string, passed: boolean, detail?: string) {
  results.push({ name, passed, detail });
}

async function main() {
  // ── Load artifacts ─────────────────────────────────────────────────────────
  const schemaSql = readFileSync(resolve(ROOT, 'supabase/schema.sql'), 'utf-8');
  const migrationPath = resolve(ROOT, 'supabase/migrations/20260424_brands_schema_consolidation.sql');
  const migrationSql = readFileSync(migrationPath, 'utf-8');

  const schemaCols = parseSchemaBrands(schemaSql);
  const migrationCols = parseMigrationAddColumns(migrationSql);

  // ── Live DB probe ──────────────────────────────────────────────────────────
  const probe = await db.from('brands').select('*').limit(1);
  if (probe.error) {
    console.error('FAIL: cannot read brands table:', probe.error.message);
    process.exit(1);
  }
  const liveCols = new Set(Object.keys(probe.data?.[0] ?? {}));

  // ── Checks ─────────────────────────────────────────────────────────────────
  const schemaSet = new Set(schemaCols);
  const migSet = new Set(migrationCols);

  // 1. schema.sql ⊆ live
  const missingInLive = schemaCols.filter(c => !liveCols.has(c));
  check(
    `schema.sql columns all exist in live DB (${schemaCols.length} declared)`,
    missingInLive.length === 0,
    missingInLive.length ? `missing in live: ${missingInLive.join(', ')}` : undefined,
  );

  // 2. live ⊆ schema.sql (no reverse drift)
  const missingInSchema = [...liveCols].filter(c => !schemaSet.has(c));
  check(
    `live DB columns all declared in schema.sql (${liveCols.size} live)`,
    missingInSchema.length === 0,
    missingInSchema.length ? `missing in schema.sql: ${missingInSchema.join(', ')}` : undefined,
  );

  // 3. migration adds exactly the "post-initial" columns of schema.sql.
  // The initial block ends at `created_at` (original schema). Everything
  // after that should be present in the migration.
  const createdAtIdx = schemaCols.indexOf('created_at');
  const postInitial = createdAtIdx >= 0 ? schemaCols.slice(createdAtIdx + 1) : [];
  const missingFromMigration = postInitial.filter(c => !migSet.has(c));
  const extraInMigration = migrationCols.filter(c => !postInitial.includes(c));
  check(
    `migration 20260424 lists every post-initial column from schema.sql (${postInitial.length} expected, ${migrationCols.length} in migration)`,
    missingFromMigration.length === 0 && extraInMigration.length === 0,
    [
      missingFromMigration.length ? `missing from migration: ${missingFromMigration.join(', ')}` : '',
      extraInMigration.length ? `extra in migration: ${extraInMigration.join(', ')}` : '',
    ].filter(Boolean).join(' | ') || undefined,
  );

  // 4. Parallel tables documented in audit actually exist.
  async function tableExists(name: string): Promise<boolean> {
    const r = await db.from(name).select('*').limit(0);
    if (!r.error) return true;
    const msg = r.error.message.toLowerCase();
    return !(msg.includes('does not exist') || msg.includes('could not find'));
  }
  const expected: Array<[string, boolean]> = [
    ['brand_material', true],
    ['calendar_events', true],
    ['seasonal_dates', true],
    ['inspiration_bank', true],
    ['brand_kit', false],
  ];
  for (const [name, shouldExist] of expected) {
    const actual = await tableExists(name);
    check(
      `parallel table \`${name}\` ${shouldExist ? 'exists' : 'does NOT exist'}`,
      actual === shouldExist,
      `expected ${shouldExist}, got ${actual}`,
    );
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  let passed = 0;
  let failed = 0;
  for (const r of results) {
    const icon = r.passed ? '✓' : '✗';
    console.log(`${icon} ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
    if (r.passed) passed++; else failed++;
  }
  console.log('');
  console.log(`${passed}/${results.length} checks passed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
