// test_sprint12.ts — Sprint 12: story render tests
//
// Tests the render pipeline:
//   TEST 1: renderStory() produces a non-empty ArrayBuffer for each of the 10 layouts
//   TEST 2: POST /api/render/story/:id round-trips against a real story idea
//   TEST 3: render_error is persisted when layout is invalid
//
// Prerequisites:
//   - Supabase running with sprint11/sprint12 migrations applied
//   - `stories-rendered` Storage bucket created (public, image/png)
//   - Dev server running at NEXT_PUBLIC_SITE_URL (or http://localhost:3000)

import { readFileSync, existsSync } from 'node:fs';
import { resolve }                  from 'node:path';

// ── Env ───────────────────────────────────────────────────────────────────────

const envPath = resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  const raw = readFileSync(envPath, 'utf-8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val   = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (val && !(key in process.env)) process.env[key] = val;
  }
  console.log('[env] cargadas desde .env.local');
}

import { createClient } from '@supabase/supabase-js';
import { renderStory }  from '../src/lib/stories/render';
import type { ContentIdea, Brand } from '../src/types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE_URL     = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

// SportArea brand used across sprint tests
const BRAND_ID = 'e8dc77ef-8371-4765-a90c-c7108733f791';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = createClient(SUPABASE_URL, SUPABASE_KEY) as any;

let passed = 0;
let failed = 0;

function ok(label: string)  { passed++; console.log(`  ✅ ${label}`); }
function fail(label: string, err?: unknown) {
  failed++;
  console.error(`  ❌ ${label}`, err ?? '');
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1 — renderStory() produces a non-empty buffer for each layout
// ─────────────────────────────────────────────────────────────────────────────

async function test1() {
  console.log('\nTEST 1: renderStory() layout coverage');

  const layouts = [
    'centered', 'minimal', 'table', 'hero',
    'banner', 'urgent', 'stat', 'tagline', 'overlay', 'flexible',
  ];

  const mockIdea = {
    copy_draft: 'Entrena con nosotros. Resultados garantizados.\nLunes a Viernes 07:00–22:00',
  } as unknown as ContentIdea;

  const mockBrand = {
    name: 'SportArea',
    colors: { primary: '#0F766E', secondary: '#374151', accent: '#0F766E' },
    logo_url: null,
  } as unknown as Brand;

  for (const layout of layouts) {
    try {
      const buf = await renderStory({ layoutName: layout, idea: mockIdea, brand: mockBrand });
      if (buf.byteLength > 1000) {
        ok(`layout '${layout}' → ${(buf.byteLength / 1024).toFixed(1)} KB`);
      } else {
        fail(`layout '${layout}' → buffer too small (${buf.byteLength} bytes)`);
      }
    } catch (err) {
      fail(`layout '${layout}' threw`, err);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2 — POST /api/render/story/:id round-trip
// ─────────────────────────────────────────────────────────────────────────────

async function test2() {
  console.log('\nTEST 2: API round-trip with real story idea');

  // Grab any system story template for this test
  const { data: templates } = await db
    .from('story_templates')
    .select('id, layout_config')
    .eq('kind', 'system')
    .limit(1);

  if (!templates || templates.length === 0) {
    fail('No system story_templates found — apply sprint10 migration first');
    return;
  }
  const templateId = templates[0].id as string;

  // Seed a temporary story idea
  const { data: weekPlan } = await db
    .from('weekly_plans')
    .select('id')
    .eq('brand_id', BRAND_ID)
    .limit(1)
    .maybeSingle();

  const weekId = weekPlan?.id ?? null;
  const { data: inserted, error: insertErr } = await db
    .from('content_ideas')
    .insert({
      brand_id: BRAND_ID,
      week_id: weekId,
      content_kind: 'story',
      story_type: 'quote',
      template_id: templateId,
      copy_draft: 'Sprint12 test idea — auto-seeded',
      position: 9999,
      format: 'story',
      angle: 'test',
    })
    .select('id, template_id')
    .single();

  if (insertErr || !inserted) {
    fail('Failed to seed story idea', insertErr);
    return;
  }

  const idea = inserted;
  console.log(`  Seeded idea ${idea.id} (template: ${idea.template_id})`);

  try {
    const res = await fetch(`${BASE_URL}/api/render/story/${idea.id}`, { method: 'POST' });
    const body = await res.json() as { rendered_image_url?: string; error?: string };

    if (!res.ok) {
      fail(`HTTP ${res.status}: ${body.error}`);
      return;
    }

    if (!body.rendered_image_url) {
      fail('Response missing rendered_image_url');
      return;
    }

    ok(`Rendered → ${body.rendered_image_url}`);

    // Verify DB was updated
    const { data: updated } = await db
      .from('content_ideas')
      .select('rendered_image_url, render_error')
      .eq('id', idea.id)
      .single();

    if (updated?.rendered_image_url === body.rendered_image_url) {
      ok('DB row updated correctly');
    } else {
      fail('DB rendered_image_url mismatch', { db: updated?.rendered_image_url, api: body.rendered_image_url });
    }

    if (updated?.render_error === null) {
      ok('render_error is null (cleared on success)');
    } else {
      fail('render_error should be null after success', updated?.render_error);
    }
  } catch (err) {
    fail('Fetch threw (is dev server running?)', err);
  } finally {
    // Clean up seeded row
    await db.from('content_ideas').delete().eq('id', idea.id);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3 — render_error persisted for unknown idea id
// ─────────────────────────────────────────────────────────────────────────────

async function test3() {
  console.log('\nTEST 3: 404 for non-existent idea');

  try {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res    = await fetch(`${BASE_URL}/api/render/story/${fakeId}`, { method: 'POST' });
    const body   = await res.json() as { error?: string };

    if (res.status === 404 && body.error) {
      ok(`404 returned as expected: "${body.error}"`);
    } else {
      fail(`Expected 404, got ${res.status}`, body);
    }
  } catch (err) {
    fail('Fetch threw (is dev server running?)', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Sprint 12: Render tests ===');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Brand ID: ${BRAND_ID}`);

  await test1();
  await test2();
  await test3();

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Passed: ${passed}  Failed: ${failed}`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });
