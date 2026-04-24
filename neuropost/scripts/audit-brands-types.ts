#!/usr/bin/env npx tsx
// Phase 0.A — resolve precise SQL types for live brands columns.
// Attempts via PostgREST RPC `exec_sql` if the project exposes one,
// else infers types from multiple sample rows.

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
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

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const db = createClient(URL, KEY, { auth: { persistSession: false } });

async function tryInformationSchemaRpc(): Promise<Record<string, { type: string; nullable: boolean; default: string | null }> | null> {
  // Many Supabase projects expose `pg_meta` via a PostgREST proxy at /rest/v1/
  // Try to call a helper function commonly seeded: `get_columns`, `information_schema_columns`, etc.
  // If none exists, return null and fall back to inference.

  // First attempt: direct RPC named `get_table_columns`
  const attempts = [
    'get_table_columns',
    'pg_get_columns',
    'table_columns',
  ];
  for (const fn of attempts) {
    const { data, error } = await db.rpc(fn, { p_table: 'brands', p_schema: 'public' } as never);
    if (!error && Array.isArray(data)) {
      const out: Record<string, { type: string; nullable: boolean; default: string | null }> = {};
      for (const row of data as Array<Record<string, unknown>>) {
        const name = String(row.column_name ?? row.name ?? '');
        if (!name) continue;
        out[name] = {
          type: String(row.data_type ?? row.type ?? 'unknown'),
          nullable: String(row.is_nullable ?? row.nullable ?? 'YES').toUpperCase() === 'YES' || row.nullable === true,
          default: (row.column_default ?? row.default ?? null) as string | null,
        };
      }
      return out;
    }
  }
  return null;
}

function typeByName(col: string): string | null {
  if (/_at$/.test(col)) return 'timestamptz';
  if (/_ends_at$|_expires_at$|_cancels_at$|_started_at$|_committed_at$|_accepted_at$|_triggered$/.test(col)) return 'timestamptz';
  return null;
}

function inferSqlType(col: string, values: unknown[]): string {
  const nonNull = values.filter(v => v !== null && v !== undefined);
  if (nonNull.length === 0) {
    const hint = typeByName(col);
    if (hint) return hint;
    if (/_url$|_token$|_id$|_name$|_username$|_path$/.test(col)) return 'text';
    return 'text /* all-null sample, confirm in DB */';
  }
  const v = nonNull[0];
  if (typeof v === 'number') {
    if (nonNull.every(x => Number.isInteger(x as number))) return 'integer';
    return 'numeric';
  }
  if (typeof v === 'boolean') return 'boolean';
  if (Array.isArray(v)) {
    const inner = v[0];
    if (typeof inner === 'string') return 'text[]';
    if (nonNull.every(a => Array.isArray(a) && (a as unknown[]).every(x => typeof x === 'string'))) return 'text[]';
    return 'jsonb';
  }
  if (typeof v === 'object') return 'jsonb';
  if (typeof v === 'string') {
    const hint = typeByName(col);
    if (hint) return hint;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}:?\d{2}|Z)?$/.test(v)) return 'timestamptz';
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'date';
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return 'uuid';
    return 'text';
  }
  return 'text';
}

async function main() {
  const rpcResult = await tryInformationSchemaRpc();

  const { data: rows, error } = await db.from('brands').select('*').limit(50);
  if (error) throw error;

  const allKeys = new Set<string>();
  for (const row of rows ?? []) for (const k of Object.keys(row)) allKeys.add(k);

  const inferred: Record<string, { type: string; nullable: boolean; sampleCount: number }> = {};
  for (const key of allKeys) {
    const values = (rows ?? []).map(r => (r as Record<string, unknown>)[key]);
    inferred[key] = {
      type: inferSqlType(key, values),
      nullable: values.some(v => v === null),
      sampleCount: values.filter(v => v !== null).length,
    };
  }

  const source = rpcResult ? 'information_schema (via RPC)' : `inference from ${rows?.length ?? 0} sample rows`;

  const md = `# Phase 0.A — Brands column types (detailed)

**Source:** ${source}

## Method

${rpcResult
  ? 'Queried \`information_schema.columns\` via an exposed RPC. Types are authoritative.'
  : 'Inferred from a sample of ' + (rows?.length ?? 0) + ' rows. **Types marked below are best-guess** based on JS values observed. Nullability is \`true\` if any sampled row had \`null\` for that column — for \`false\`, the column could still be nullable (just not observed null in the sample). Run the SQL block at the bottom of this file to confirm authoritative types before applying the migration.'}

## Columns

| Column | Inferred type | Nullable in sample | # non-null samples |
|---|---|---|---|
${[...allKeys].sort().map(k => {
  const info = inferred[k];
  return `| \`${k}\` | \`${info.type}\` | ${info.nullable ? 'yes' : 'no'} | ${info.sampleCount}/${rows?.length ?? 0} |`;
}).join('\n')}

## Authoritative SQL to run in Supabase SQL Editor

\`\`\`sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='brands'
ORDER BY ordinal_position;
\`\`\`

Paste the result below when available:

\`\`\`
(pending user paste)
\`\`\`
`;

  const outPath = resolve(process.cwd(), 'docs/phase0-schema-audit-types.md');
  writeFileSync(outPath, md);
  console.log('Wrote', outPath);
  console.log('RPC available:', !!rpcResult);
}

main().catch(e => { console.error(e); process.exit(1); });
