#!/usr/bin/env npx tsx
// =============================================================================
// Phase 3.0 — Camino 3: recontextualization benchmark
// =============================================================================
// Goal: preserve the SUBJECT conceptually while changing background / lighting
// / staging. The swimming pool should remain recognizably THAT pool (same
// ceramic tiles, lane ropes colors, ceiling), the burger should remain THAT
// burger (same patty, same bun, same cheese colour).
//
// Matrix:
//   A. Piscina (good) × 3 treatments × Flux Kontext Pro
//   B. Piscina (good) × 3 treatments × Flux Redux Dev (img variation)
//   C. Burger  (low)  × 5 treatments × Flux Kontext Pro      (case study)
//
// fal.ai variants are skipped in this run because the fal.ai account is
// locked due to exhausted balance (see Paso 2 results).

import { config }       from 'dotenv';
import { writeFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve }      from 'node:path';

config({ path: resolve(process.cwd(), '.env.local') });

interface SampleInfo { key: string; description: string; quality: string; publicUrl: string }

interface Result {
  sample:       string;
  treatment:    string;
  model:        string;
  elapsed_sec:  number;
  cost_usd_est: number;
  output_url?:  string;
  output_local?:string;
  bytes?:       number;
  error?:       string;
  prompt?:      string;
}

// -- Gym / pool treatments --------------------------------------------------
const POOL_TREATMENTS = [
  {
    id:     't1-editorial',
    prompt: 'Same indoor swimming pool, same swimmer, same lane ropes, same tiles. Change lighting to warm natural daylight from a side window, shallow depth of field, editorial magazine style, clean and cinematic. Keep the subject identity and framing.',
  },
  {
    id:     't2-moody',
    prompt: 'Same indoor swimming pool and same swimmer, same lane ropes and pool tiles. Moody dramatic lighting, dark blue tones, high contrast shadows, cinematic colour grading, misty atmosphere. Same composition and subject identity.',
  },
  {
    id:     't3-studio-pop',
    prompt: 'Same pool subject and swimmer, same lane ropes colours. Replace the surrounding environment with a clean studio setting, bright white/vibrant cyan background, pop editorial aesthetic, crisp details. Same subject identity.',
  },
];

// -- Burger treatments ------------------------------------------------------
const BURGER_TREATMENTS = [
  {
    id:     't1-pink-flat',
    prompt: 'The same cheeseburger with the identical bun, patty, cheese and lettuce arrangement. Photograph it on a flat solid hot-pink background, top-down, studio lighting, bold pop-art minimalism. Product identity unchanged.',
  },
  {
    id:     't2-ingredients-floating',
    prompt: 'The same cheeseburger with identical bun, patty, cheese, lettuce. Compose it in mid-air with its raw ingredients floating around it (tomato slice, onion ring, sesame seeds, cheddar slice). Clean white studio backdrop, hard studio light, sharp focus. Product identity unchanged.',
  },
  {
    id:     't3-macro',
    prompt: 'Extreme macro close-up of the same cheeseburger. Focus on the juicy patty texture, melted cheddar drip, sesame seeds on bun. Warm diffused light, shallow depth of field, commercial food photography style. Product identity unchanged.',
  },
  {
    id:     't4-editorial-moody',
    prompt: 'The same cheeseburger on a dark wooden board with rustic props (knife, linen napkin, small bowl of sauce). Moody chiaroscuro lighting, single window light, editorial food magazine. Product identity unchanged.',
  },
  {
    id:     't5-fresh-natural',
    prompt: 'The same cheeseburger on a wooden tray outdoors, sunny daylight, fresh greenery in the background, picnic context. Authentic documentary food photography, warm colours. Product identity unchanged.',
  },
];

const COST: Record<string, number> = {
  'flux-kontext-pro': 0.04,
  'flux-redux-dev':   0.03,
};

async function replicateRun(model: string, input: Record<string, unknown>): Promise<string> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN missing');
  const res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body:   JSON.stringify({ input }),
  });
  if (!res.ok) throw new Error(`Replicate ${model} create failed: ${res.status} ${await res.text()}`);
  const pred = await res.json() as { id: string; urls: { get: string } };
  for (let i = 0; i < 90; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const poll = await fetch(pred.urls.get, { headers: { Authorization: `Bearer ${token}` } });
    const st   = await poll.json() as { status: string; output?: string | string[]; error?: string };
    if (st.status === 'succeeded') {
      const out = Array.isArray(st.output) ? st.output[0] : st.output;
      if (!out) throw new Error('Empty output');
      return out;
    }
    if (st.status === 'failed' || st.status === 'canceled') throw new Error(`Replicate failed: ${st.error}`);
  }
  throw new Error('Replicate timeout');
}

async function downloadAndSave(url: string, localPath: string): Promise<number> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(localPath, buf);
  return buf.length;
}

async function main() {
  const manifestPath = resolve(process.cwd(), 'docs/phase3-research/samples/originals/manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as SampleInfo[];
  const pool   = manifest.find(s => s.key === '01-piscina-good');
  const burger = manifest.find(s => s.key === '04-burger-low');
  if (!pool || !burger) throw new Error('Missing source samples');

  const outBase = resolve(process.cwd(), 'docs/phase3-research/samples/camino3');
  await mkdir(outBase, { recursive: true });

  const results: Result[] = [];

  // ── Block A: Pool × 3 treatments × flux-kontext-pro ──────────────────────
  console.log('\n=== A. Pool × flux-kontext-pro ===');
  for (const t of POOL_TREATMENTS) {
    const dir = resolve(outBase, `pool-${t.id}`);
    await mkdir(dir, { recursive: true });
    try {
      const t0 = Date.now();
      const url = await replicateRun('black-forest-labs/flux-kontext-pro', {
        prompt:        t.prompt,
        input_image:   pool.publicUrl,
        output_format: 'jpg',
        guidance:      2.5,
      });
      const elapsed = (Date.now() - t0) / 1000;
      const local = resolve(dir, 'flux-kontext-pro.jpg');
      const bytes = await downloadAndSave(url, local);
      console.log(`  ✓ ${t.id}  ${elapsed.toFixed(1)}s  ${(bytes/1024).toFixed(0)} KB`);
      results.push({ sample: 'pool', treatment: t.id, model: 'flux-kontext-pro', elapsed_sec: elapsed, cost_usd_est: COST['flux-kontext-pro'], output_url: url, output_local: local, bytes, prompt: t.prompt });
    } catch (err) {
      console.log(`  ✗ ${t.id}  ${(err as Error).message}`);
      results.push({ sample: 'pool', treatment: t.id, model: 'flux-kontext-pro', elapsed_sec: 0, cost_usd_est: COST['flux-kontext-pro'], error: (err as Error).message, prompt: t.prompt });
    }
  }

  // ── Block B: Pool × 3 treatments × flux-redux-dev (img variation) ────────
  // Redux Dev takes a reference image and generates variations. It's more
  // "inspired by" than "edit of" — useful to see the spectrum.
  console.log('\n=== B. Pool × flux-redux-dev ===');
  for (const t of POOL_TREATMENTS) {
    const dir = resolve(outBase, `pool-${t.id}`);
    await mkdir(dir, { recursive: true });
    try {
      const t0 = Date.now();
      const url = await replicateRun('black-forest-labs/flux-redux-dev', {
        redux_image:   pool.publicUrl,
        prompt:        t.prompt,
        num_outputs:   1,
        aspect_ratio:  '3:2',
        output_format: 'jpg',
        guidance:      3,
      });
      const elapsed = (Date.now() - t0) / 1000;
      const local = resolve(dir, 'flux-redux-dev.jpg');
      const bytes = await downloadAndSave(url, local);
      console.log(`  ✓ ${t.id}  ${elapsed.toFixed(1)}s  ${(bytes/1024).toFixed(0)} KB`);
      results.push({ sample: 'pool', treatment: t.id, model: 'flux-redux-dev', elapsed_sec: elapsed, cost_usd_est: COST['flux-redux-dev'], output_url: url, output_local: local, bytes, prompt: t.prompt });
    } catch (err) {
      console.log(`  ✗ ${t.id}  ${(err as Error).message}`);
      results.push({ sample: 'pool', treatment: t.id, model: 'flux-redux-dev', elapsed_sec: 0, cost_usd_est: COST['flux-redux-dev'], error: (err as Error).message, prompt: t.prompt });
    }
  }

  // ── Block C: Burger × 5 treatments × flux-kontext-pro ────────────────────
  console.log('\n=== C. Burger × flux-kontext-pro (case study) ===');
  for (const t of BURGER_TREATMENTS) {
    const dir = resolve(outBase, `burger-${t.id}`);
    await mkdir(dir, { recursive: true });
    try {
      const t0 = Date.now();
      const url = await replicateRun('black-forest-labs/flux-kontext-pro', {
        prompt:        t.prompt,
        input_image:   burger.publicUrl,
        output_format: 'jpg',
        guidance:      2.5,
      });
      const elapsed = (Date.now() - t0) / 1000;
      const local = resolve(dir, 'flux-kontext-pro.jpg');
      const bytes = await downloadAndSave(url, local);
      console.log(`  ✓ ${t.id}  ${elapsed.toFixed(1)}s  ${(bytes/1024).toFixed(0)} KB`);
      results.push({ sample: 'burger', treatment: t.id, model: 'flux-kontext-pro', elapsed_sec: elapsed, cost_usd_est: COST['flux-kontext-pro'], output_url: url, output_local: local, bytes, prompt: t.prompt });
    } catch (err) {
      console.log(`  ✗ ${t.id}  ${(err as Error).message}`);
      results.push({ sample: 'burger', treatment: t.id, model: 'flux-kontext-pro', elapsed_sec: 0, cost_usd_est: COST['flux-kontext-pro'], error: (err as Error).message, prompt: t.prompt });
    }
  }

  const resultsPath = resolve(outBase, 'results.json');
  await writeFile(resultsPath, JSON.stringify({
    run_at:             new Date().toISOString(),
    total_cost_usd_est: results.reduce((a, r) => a + (r.error ? 0 : r.cost_usd_est), 0),
    results,
  }, null, 2));
  console.log(`\nResults → ${resultsPath}`);
  console.log(`Estimated total cost: $${results.reduce((a, r) => a + (r.error ? 0 : r.cost_usd_est), 0).toFixed(3)}`);
}

main().catch(err => { console.error(err); process.exit(1); });
