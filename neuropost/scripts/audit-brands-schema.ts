#!/usr/bin/env npx tsx
// =============================================================================
// audit-brands-schema.ts — Phase 0.A: live DB vs schema.sql audit
// =============================================================================
// Produces docs/phase0-schema-audit.md with:
//   - Columns live in public.brands that are missing from schema.sql
//   - Columns in schema.sql that are not live in DB (inverse drift)
//   - Existence of parallel tables mentioned in the investigation
//
// Run: npx tsx --tsconfig tsconfig.json scripts/audit-brands-schema.ts

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── Load .env.local ──────────────────────────────────────────────────────────

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
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(URL, KEY, { auth: { persistSession: false } });

// ── Parse schema.sql CREATE TABLE brands ─────────────────────────────────────

interface SchemaCol {
  name: string;
  type: string;
  default?: string;
  notNull: boolean;
}

function parseSchemaBrands(sql: string): SchemaCol[] {
  const match = sql.match(/create\s+table\s+if\s+not\s+exists\s+public\.brands\s*\(([\s\S]*?)\n\)\s*;/i);
  if (!match) throw new Error('Could not find CREATE TABLE brands in schema.sql');
  const body = match[1];
  const lines = body
    .split('\n')
    .map(l => l.replace(/--.*$/, '').trim())
    .filter(l => l.length > 0 && !l.startsWith('--'));
  const cols: SchemaCol[] = [];
  for (const raw of lines) {
    const line = raw.replace(/,\s*$/, '').trim();
    if (!line) continue;
    if (/^(primary\s+key|unique|constraint|foreign\s+key|check)/i.test(line)) continue;
    const m = line.match(/^"?(\w+)"?\s+([a-z_\[\]\(\)0-9]+)\b([\s\S]*)$/i);
    if (!m) continue;
    const [, name, type, rest] = m;
    const restLower = rest.toLowerCase();
    const notNull = /not\s+null/.test(restLower);
    const defaultMatch = restLower.match(/default\s+(.+?)(?:\s+not\s+null|\s+references|\s*$)/);
    cols.push({
      name,
      type: type.toLowerCase(),
      default: defaultMatch ? defaultMatch[1].trim() : undefined,
      notNull,
    });
  }
  return cols;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const schemaSql = readFileSync(resolve(process.cwd(), 'supabase/schema.sql'), 'utf-8');
  const schemaCols = parseSchemaBrands(schemaSql);
  const schemaNames = new Set(schemaCols.map(c => c.name));

  let liveColumns: { column_name: string; data_type: string; is_nullable: string; column_default: string | null }[] = [];

  // Fallback: read one row and take the keys
  const probe = await db.from('brands').select('*').limit(1);
  if (probe.error) {
    console.error('Could not read brands table:', probe.error.message);
    process.exit(1);
  }
  const firstRow = probe.data?.[0] ?? {};
  liveColumns = Object.keys(firstRow).map(k => ({
    column_name: k,
    data_type: typeof (firstRow as Record<string, unknown>)[k],
    is_nullable: 'unknown',
    column_default: null,
  }));

  // Direct introspection via REST /rest/v1/ is not possible for information_schema
  // without an RPC. We call a PostgREST endpoint via fetch if configured, else
  // we fall back to enumerating keys from a sample row (works when at least one
  // row exists). We augment with a direct HTTP call to PostgREST RPC if the
  // `introspect_columns` function does not exist — in that case we'll document
  // the limitation.

  const liveNames = new Set(liveColumns.map(c => c.column_name));

  // Parallel tables existence — try select on each and see if we get a schema error
  async function tableExists(name: string): Promise<boolean> {
    const r = await db.from(name).select('*').limit(0);
    if (r.error) {
      const msg = r.error.message.toLowerCase();
      if (msg.includes('does not exist') || msg.includes('could not find')) return false;
      // Other errors still indicate the table exists (RLS, type, etc.)
      return true;
    }
    return true;
  }

  const parallel = {
    seasonal_dates:   await tableExists('seasonal_dates'),
    inspiration_bank: await tableExists('inspiration_bank'),
    brand_kit:        await tableExists('brand_kit'),
    calendar_events:  await tableExists('calendar_events'),
    brand_material:   await tableExists('brand_material'),
  };

  // Diff
  const liveMissingFromSchema = [...liveNames].filter(n => !schemaNames.has(n)).sort();
  const schemaNotLive = [...schemaNames].filter(n => !liveNames.has(n)).sort();

  const ts = new Date().toISOString().slice(0, 10);
  const md = `# Phase 0.A — Brands schema audit

**Date:** ${ts}
**Source:** live DB probe of \`public.brands\` (sample row keys) + parse of \`supabase/schema.sql\`.
**Caveat:** the probe uses a sample row, so it lists column **names** but not precise types/defaults. For canonical types, cross-reference with Supabase dashboard.

## Columns live in DB that are MISSING from schema.sql

${liveMissingFromSchema.length === 0
  ? '_(none — schema.sql already matches live)_'
  : liveMissingFromSchema.map(c => `- \`${c}\``).join('\n')}

## Columns in schema.sql NOT visible in live sample

${schemaNotLive.length === 0
  ? '_(none)_'
  : schemaNotLive.map(c => `- \`${c}\``).join('\n') + '\n\n_Note: a column can be present in DB but absent from the sample if the value was null for the probed row. Treat with caution._'}

## Columns in schema.sql (canonical list parsed)

${schemaCols.map(c => `- \`${c.name}\` ${c.type}${c.notNull ? ' NOT NULL' : ''}${c.default ? ` DEFAULT ${c.default}` : ''}`).join('\n')}

## Columns in live sample (all keys of a sample row)

${[...liveNames].sort().map(c => `- \`${c}\``).join('\n')}

## Parallel tables existence

| Table | Exists in DB |
|---|---|
${Object.entries(parallel).map(([t, e]) => `| \`${t}\` | ${e ? '✅ yes' : '❌ no'} |`).join('\n')}

## Decisions for Phase 0.A

Columns confirmed missing from \`schema.sql\` and referenced by code
(from \`docs/creative-direction-investigation.md\` §2.1):

- \`visual_style\` — ${liveNames.has('visual_style') ? 'live' : 'NOT live — verify separately'}
- \`description\` — ${liveNames.has('description') ? 'live' : 'NOT live — verify separately'}
- \`logo_url\` — ${liveNames.has('logo_url') ? 'live' : 'NOT live — verify separately'}
- \`calendar_events_generated_at\` — ${liveNames.has('calendar_events_generated_at') ? 'live' : 'NOT live — verify separately'}

Action: update \`schema.sql\` to include all columns flagged as
"live in DB, missing from schema.sql" above, plus emit a consolidation
migration (\`ADD COLUMN IF NOT EXISTS\`) that is no-op on production.
`;

  // Machine-generated raw audit output. The curated narrative lives in
  // docs/phase0-schema-audit.md and should NOT be overwritten by re-runs.
  const outPath = resolve(process.cwd(), 'docs/phase0-schema-audit-raw.md');
  writeFileSync(outPath, md);
  console.log('Wrote', outPath);
  console.log('Live columns:', [...liveNames].sort().join(', '));
  console.log('Missing from schema.sql:', liveMissingFromSchema.join(', ') || '(none)');
  console.log('In schema.sql but not sampled:', schemaNotLive.join(', ') || '(none)');
  console.log('Parallel tables:', parallel);
}

main().catch(e => { console.error(e); process.exit(1); });
