// =============================================================================
// test_visual_strategist.ts — Integration tests for Sprint 1: Visual Strategist
// =============================================================================
// Tests:
//   1. Migration: posts.agent_brief, posts.delivery_mode, post_revisions table
//   2. fallbackBrief() produces valid AgentBrief without Claude (txt2img + img2img)
//   3. runVisualStrategist() returns valid AgentBrief (live — requires ANTHROPIC_API_KEY)
//   4. agent_brief persisted on post and readable back from Supabase
//   5. post_revisions row can be inserted with brief_snapshot
//
// Run:
//   npm run test:visual-strategist
// or:
//   npx tsx scripts/test_visual_strategist.ts

import { readFileSync, existsSync } from 'node:fs';
import { resolve }                  from 'node:path';

// ── Load .env.local ───────────────────────────────────────────────────────────
const envPath = resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let   val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (val && !(key in process.env)) process.env[key] = val;
  }
}

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = createClient(supabaseUrl, supabaseKey) as any;

// ── Helpers ───────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function ok(label: string)  { console.log(`  ✅  ${label}`); passed++; }
function fail(label: string, detail?: string) {
  console.error(`  ❌  ${label}${detail ? `\n     ${detail}` : ''}`);
  failed++;
}
function section(title: string) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`);
}

async function getTestBrandId(): Promise<string | null> {
  const { data } = await db.from('brands').select('id').limit(1).maybeSingle();
  return data?.id ?? null;
}

// ── TEST 1: Migration columns ─────────────────────────────────────────────────
async function test1() {
  section('TEST 1 — Migration columns + post_revisions table');

  const { error: e1 } = await db.from('posts').select('agent_brief').limit(1);
  e1 ? fail('posts.agent_brief column exists', e1.message) : ok('posts.agent_brief column exists');

  const { error: e2 } = await db.from('posts').select('agent_brief_generated_at').limit(1);
  e2 ? fail('posts.agent_brief_generated_at column exists', e2.message) : ok('posts.agent_brief_generated_at column exists');

  const { error: e3 } = await db.from('posts').select('delivery_mode').limit(1);
  e3 ? fail('posts.delivery_mode column exists', e3.message) : ok('posts.delivery_mode column exists');

  const { error: e4 } = await db.from('post_revisions').select('id').limit(1);
  e4 ? fail('post_revisions table exists', e4.message) : ok('post_revisions table exists');
}

// ── TEST 2: fallbackBrief (no Claude call) ────────────────────────────────────
async function test2() {
  section('TEST 2 — fallbackBrief() produces valid AgentBrief');
  try {
    const { fallbackBrief, AgentBriefSchema } = await import('../src/agents/VisualStrategistAgent.js');

    const brief = fallbackBrief({
      clientDescription: 'Plato del día: paella valenciana',
      brandContext:      'Restaurante La Huerta — tono cercano',
      sector:            'restaurante',
      visualStyle:       'warm',
      format:            'post',
      sourceImageUrl:    null,
    });
    const parsed = AgentBriefSchema.safeParse(brief);
    parsed.success
      ? ok('fallbackBrief (no image) passes AgentBriefSchema')
      : fail('fallbackBrief (no image) schema valid', parsed.error.message);

    if (brief.mode === 'txt2img') {
      ok('fallbackBrief without image → mode=txt2img');
    } else {
      fail('fallbackBrief without image → mode=txt2img', `got: ${brief.mode}`);
    }

    const briefImg = fallbackBrief({
      clientDescription: 'Editar foto del plato',
      brandContext:      'Restaurante La Huerta',
      sector:            'restaurante',
      visualStyle:       'warm',
      format:            'post',
      sourceImageUrl:    'https://example.com/photo.jpg',
    });
    if (briefImg.mode === 'img2img') {
      ok('fallbackBrief with image → mode=img2img');
    } else {
      fail('fallbackBrief with image → mode=img2img', `got: ${briefImg.mode}`);
    }
    if (briefImg.model === 'flux-kontext-pro') {
      ok('fallbackBrief with image → model=flux-kontext-pro');
    } else {
      fail('fallbackBrief with image → model=flux-kontext-pro', `got: ${briefImg.model}`);
    }
  } catch (e) {
    fail('fallbackBrief import/execution', e instanceof Error ? e.message : String(e));
  }
}

// ── TEST 3: runVisualStrategist (live Claude call) ────────────────────────────
async function test3() {
  section('TEST 3 — runVisualStrategist() returns valid AgentBrief (live)');
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('  ⚠️   ANTHROPIC_API_KEY not set — skipping live call');
    return;
  }
  try {
    const { runVisualStrategist, AgentBriefSchema } = await import('../src/agents/VisualStrategistAgent.js');
    const brief = await runVisualStrategist({
      clientDescription: 'Foto de nuestro nuevo menú degustación con maridaje de vinos',
      brandContext:      'El Rincón Gourmet — alta cocina mediterránea, tono elegante',
      sector:            'restaurante',
      visualStyle:       'elegant',
      format:            'post',
      sourceImageUrl:    null,
    });
    const parsed = AgentBriefSchema.safeParse(brief);
    parsed.success
      ? ok('runVisualStrategist (txt2img) passes schema')
      : fail('runVisualStrategist (txt2img) schema valid', parsed.error.message);

    if (typeof brief.generation_prompt === 'string' && brief.generation_prompt.length > 10) {
      ok(`generation_prompt non-empty (${brief.generation_prompt.slice(0, 60)}…)`);
    } else {
      fail('generation_prompt non-empty', `got: ${JSON.stringify(brief.generation_prompt)}`);
    }
    if (brief.mode === 'txt2img' && brief.model === 'flux-pro') {
      ok('no-image brief → mode=txt2img, model=flux-pro');
    } else {
      fail('no-image brief → mode=txt2img, model=flux-pro', `mode=${brief.mode} model=${brief.model}`);
    }
  } catch (e) {
    fail('runVisualStrategist live call', e instanceof Error ? e.message : String(e));
  }
}

// ── TEST 4: agent_brief persisted on post and read back ───────────────────────
let testPostId: string | null = null;

async function test4() {
  section('TEST 4 — agent_brief persisted on post and readable');
  const brandId = await getTestBrandId();
  if (!brandId) {
    fail('Could not find a brand for test post');
    return;
  }

  const mockBrief = {
    intent:            'Showcase product in warm studio light',
    mode:              'txt2img',
    generation_prompt: 'Artisanal bread on wooden table, warm studio light, professional food photography',
    guidance:          3.0,
    strength:          null,
    model:             'flux-pro',
    confidence:        0.82,
    reasoning:         'No source image provided; generating from scratch with warm style.',
    risk_flags:        [] as string[],
    primary_image_url: null,
    inspiration_as_image: { used: false, inspiration_id: null, url: null },
  };

  const { data: post, error: insertErr } = await db
    .from('posts')
    .insert({
      brand_id:                 brandId,
      status:                   'draft',
      caption:                  '[test_visual_strategist] auto-generated — safe to delete',
      platform:                 ['instagram'],
      format:                   'post',
      agent_brief:              mockBrief,
      agent_brief_generated_at: new Date().toISOString(),
      delivery_mode:            'reviewed',
    })
    .select('id, agent_brief, delivery_mode')
    .single();

  if (insertErr || !post) {
    fail('Insert post with agent_brief', insertErr?.message);
    return;
  }
  testPostId = post.id;
  ok(`Post created with agent_brief (${testPostId})`);

  if (post.agent_brief?.intent === mockBrief.intent) {
    ok('agent_brief.intent round-trips through Supabase jsonb');
  } else {
    fail('agent_brief.intent round-trip', `got: ${post.agent_brief?.intent}`);
  }
  if (post.delivery_mode === 'reviewed') {
    ok('delivery_mode = "reviewed"');
  } else {
    fail('delivery_mode = "reviewed"', `got: ${post.delivery_mode}`);
  }
}

// ── TEST 5: post_revisions insert ─────────────────────────────────────────────
async function test5() {
  section('TEST 5 — post_revisions insert and read');
  const brandId = await getTestBrandId();
  if (!brandId || !testPostId) {
    fail('No brand/post available for post_revisions test (run test4 first)');
    return;
  }
  const { data: rev, error: revErr } = await db
    .from('post_revisions')
    .insert({
      post_id:          testPostId,
      brand_id:         brandId,
      revision_index:   0,
      prompt:           'Artisanal bread on wooden table, warm studio light',
      model:            'flux-pro',
      guidance:         3.0,
      strength:         null,
      image_url:        'https://example.com/result.jpg',
      duration_seconds: 12,
      brief_snapshot:   { intent: 'test', mode: 'txt2img' },
    })
    .select('id, revision_index')
    .single();

  if (revErr || !rev) {
    fail('Insert post_revisions row', revErr?.message);
  } else {
    ok(`post_revisions row inserted (id: ${rev.id}, index: ${rev.revision_index})`);
  }
}

// ── TEST 6–8: primary_image_url policy (live, requires ANTHROPIC_API_KEY) ─────

import type { VisualStrategistInput } from '../src/agents/VisualStrategistAgent.js';

function mockInput(opts: {
  source_images: string[];
  inspirations:  Array<{ id: string; thumbnail_url: string }>;
  client_input:  { global_description: string };
}): VisualStrategistInput {
  return {
    clientDescription: opts.client_input.global_description,
    brandContext:      'Cafetería El Grano — ambiente acogedor, tono cercano',
    sector:            'restaurante',
    visualStyle:       'warm',
    format:            'post',
    sourceImages:      opts.source_images,
    inspirations:      opts.inspirations,
  };
}

async function test6() {
  section('TEST 6 — Case A: source + inspiration → source as primary, insp.used false');
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('  ⚠️   ANTHROPIC_API_KEY not set — skipping');
    return;
  }
  try {
    const { runVisualStrategist } = await import('../src/agents/VisualStrategistAgent.js');
    const brief = await runVisualStrategist(mockInput({
      source_images: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400'],
      inspirations:  [{ id: 'insp1', thumbnail_url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400' }],
      client_input:  { global_description: 'en este estilo azul, el mismo sofá pero con luz de atardecer' },
    }));

    if (brief.primary_image_url === 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400') {
      ok('Case A: primary_image_url = source image');
    } else {
      fail('Case A: primary_image_url = source image', `got: ${brief.primary_image_url}`);
    }
    if (!brief.inspiration_as_image.used) {
      ok('Case A: inspiration_as_image.used = false');
    } else {
      fail('Case A: inspiration_as_image.used = false', `got: ${brief.inspiration_as_image.used}`);
    }
    if (brief.inspiration_as_image.url === null) {
      ok('Case A: inspiration_as_image.url = null');
    } else {
      fail('Case A: inspiration_as_image.url = null', `got: ${brief.inspiration_as_image.url}`);
    }
    if (brief.model === 'flux-kontext-pro') {
      ok('Case A: model = flux-kontext-pro');
    } else {
      fail('Case A: model = flux-kontext-pro', `got: ${brief.model}`);
    }
    // Prompt should contain visual attributes extracted from the inspiration
    if (brief.generation_prompt.length > 10) {
      ok(`Case A: generation_prompt non-empty (${brief.generation_prompt.slice(0, 60)}…)`);
    } else {
      fail('Case A: generation_prompt non-empty');
    }
  } catch (e) {
    fail('Case A live call', e instanceof Error ? e.message : String(e));
  }
}

async function test7() {
  section('TEST 7 — Case B: no source + inspiration → inspiration as primary, used true');
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('  ⚠️   ANTHROPIC_API_KEY not set — skipping');
    return;
  }
  try {
    const { runVisualStrategist } = await import('../src/agents/VisualStrategistAgent.js');
    const INSP_URL = 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400';
    const brief = await runVisualStrategist(mockInput({
      source_images: [],
      inspirations:  [{ id: 'insp1', thumbnail_url: INSP_URL }],
      client_input:  { global_description: 'un croissant de chocolate en esta misma composición' },
    }));

    if (brief.primary_image_url === INSP_URL) {
      ok('Case B: primary_image_url = inspiration thumbnail');
    } else {
      fail('Case B: primary_image_url = inspiration thumbnail', `got: ${brief.primary_image_url}`);
    }
    if (brief.inspiration_as_image.used) {
      ok('Case B: inspiration_as_image.used = true');
    } else {
      fail('Case B: inspiration_as_image.used = true', `got: ${brief.inspiration_as_image.used}`);
    }
    if (brief.inspiration_as_image.inspiration_id === 'insp1') {
      ok('Case B: inspiration_as_image.inspiration_id = insp1');
    } else {
      fail('Case B: inspiration_as_image.inspiration_id = insp1', `got: ${brief.inspiration_as_image.inspiration_id}`);
    }
    if (brief.inspiration_as_image.url === INSP_URL) {
      ok('Case B: inspiration_as_image.url = thumbnail');
    } else {
      fail('Case B: inspiration_as_image.url = thumbnail', `got: ${brief.inspiration_as_image.url}`);
    }
    if (brief.model === 'flux-kontext-pro') {
      ok('Case B: model = flux-kontext-pro');
    } else {
      fail('Case B: model = flux-kontext-pro', `got: ${brief.model}`);
    }
  } catch (e) {
    fail('Case B live call', e instanceof Error ? e.message : String(e));
  }
}

async function test8() {
  section('TEST 8 — Case C: no source, no inspiration → txt2img, primary = null');
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('  ⚠️   ANTHROPIC_API_KEY not set — skipping');
    return;
  }
  try {
    const { runVisualStrategist } = await import('../src/agents/VisualStrategistAgent.js');
    const brief = await runVisualStrategist(mockInput({
      source_images: [],
      inspirations:  [],
      client_input:  { global_description: 'café humeante sobre mesa de madera, luz cálida de mañana' },
    }));

    if (brief.primary_image_url === null) {
      ok('Case C: primary_image_url = null');
    } else {
      fail('Case C: primary_image_url = null', `got: ${brief.primary_image_url}`);
    }
    if (!brief.inspiration_as_image.used) {
      ok('Case C: inspiration_as_image.used = false');
    } else {
      fail('Case C: inspiration_as_image.used = false', `got: ${brief.inspiration_as_image.used}`);
    }
    if (brief.model === 'flux-pro') {
      ok('Case C: model = flux-pro');
    } else {
      fail('Case C: model = flux-pro', `got: ${brief.model}`);
    }
    if (brief.mode === 'txt2img') {
      ok('Case C: mode = txt2img');
    } else {
      fail('Case C: mode = txt2img', `got: ${brief.mode}`);
    }
  } catch (e) {
    fail('Case C live call', e instanceof Error ? e.message : String(e));
  }
}

// ── Cleanup ───────────────────────────────────────────────────────────────────
async function cleanup() {
  if (testPostId) {
    try { await db.from('post_revisions').delete().eq('post_id', testPostId); } catch { /* ok */ }
    try { await db.from('posts').delete().eq('id', testPostId); } catch { /* ok */ }
    console.log(`\n  🧹  Cleaned up test post ${testPostId}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Sprint 1 v2: Visual Strategist tests ===');
  await test1();
  await test2();
  await test3();
  await test4();
  await test5();
  await test6();
  await test7();
  await test8();
  await cleanup();

  console.log(`\n${'─'.repeat(62)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });
