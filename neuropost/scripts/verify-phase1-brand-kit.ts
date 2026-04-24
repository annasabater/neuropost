#!/usr/bin/env npx tsx
// =============================================================================
// verify-phase1-brand-kit.ts — Phase 1 acceptance check
// =============================================================================
// Validates the creative direction additions:
//   1. AESTHETIC_PRESETS catalog has 8 unique entries.
//   2. Each preset has all required fields.
//   3. FONT_CATALOG has >=6 display + >=5 body fonts.
//   4. (live DB) brands has the 6 new columns.
//
// Run: npx tsx --tsconfig tsconfig.json scripts/verify-phase1-brand-kit.ts

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
import { AESTHETIC_PRESETS } from '../src/lib/brand/aesthetic-presets';
import { FONT_CATALOG } from '../src/lib/stories/fonts-catalog';

interface Check { name: string; pass: boolean; details?: string; }

async function main() {
  const checks: Check[] = [];

  // 1. 8 unique presets
  const presetIds = new Set(AESTHETIC_PRESETS.map(p => p.id));
  checks.push({
    name: `AESTHETIC_PRESETS has 8 unique entries (found ${AESTHETIC_PRESETS.length})`,
    pass: AESTHETIC_PRESETS.length === 8 && presetIds.size === 8,
  });

  // 2. Required fields per preset
  const allFieldsOk = AESTHETIC_PRESETS.every(p =>
    p.id && p.name && p.tagline && p.cover_image &&
    Array.isArray(p.mood_keywords) && p.mood_keywords.length >= 4 &&
    ['none','subtle','medium','strong'].includes(p.default_overlay_intensity),
  );
  checks.push({ name: 'All presets have required fields (id, name, tagline, cover_image, ≥4 mood_keywords, default_overlay_intensity)', pass: allFieldsOk });

  // 3. Font catalog cardinality
  const displayFonts = FONT_CATALOG.filter(f => f.role === 'display');
  const bodyFonts    = FONT_CATALOG.filter(f => f.role === 'body');
  checks.push({
    name: `FONT_CATALOG has >=6 display (${displayFonts.length}) and >=5 body (${bodyFonts.length})`,
    pass: displayFonts.length >= 6 && bodyFonts.length >= 5,
  });

  // 4. Live DB columns
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const db = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await db.from('brands').select(
      'aesthetic_preset, realism_level, typography_display, typography_body, allow_graphic_elements, overlay_intensity'
    ).limit(1);
    checks.push({
      name: 'DB has all 6 new columns on brands',
      pass: !error,
      details: error?.message,
    });
  } else {
    checks.push({
      name: 'DB check (skipped — no Supabase env)',
      pass: true,
    });
  }

  let passed = 0;
  for (const c of checks) {
    const icon = c.pass ? '✓' : '✗';
    console.log(`${icon} ${c.name}${c.details ? ' — ' + c.details : ''}`);
    if (c.pass) passed++;
  }
  console.log(`\n${passed}/${checks.length} checks passed.`);
  if (passed !== checks.length) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
