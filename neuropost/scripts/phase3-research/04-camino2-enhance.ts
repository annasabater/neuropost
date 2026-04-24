#!/usr/bin/env npx tsx
// =============================================================================
// Phase 3.0 — Camino 2: photo enhancement benchmark
// =============================================================================
// For each of the 3 gym samples (good/medium/low), we run:
//   A. Flux Kontext Pro   (baseline — current system)
//   B. Flux Kontext Max   (premium variant)
//   C. fal.ai Clarity Upscaler   (image upscaler / enhancer)
//   D. fal.ai Aura-SR             (super-resolution)
//
// Goal: preservación LITERAL del sujeto + mejora de calidad técnica.
// We use one consistent enhancement prompt across all Flux Kontext runs so
// the comparison is apples-to-apples. Upscalers don't take prompts.
//
// Outputs: docs/phase3-research/samples/camino2/<sample>/<model>.jpg
// Metrics: timings + cost in docs/phase3-research/samples/camino2/results.json

import { config }       from 'dotenv';
import { writeFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve }      from 'node:path';

config({ path: resolve(process.cwd(), '.env.local') });

interface SampleInfo {
  key:          string;
  description:  string;
  quality:      string;
  publicUrl:    string;
}

interface Result {
  sample:         string;
  model:          string;
  elapsed_sec:    number;
  cost_usd_est:   number;
  output_url?:    string;
  output_local?:  string;
  bytes?:         number;
  error?:         string;
}

// -- Enhancement prompt: intentionally conservative (literal preservation) ---
const ENHANCE_PROMPT =
  'Improve the lighting, increase sharpness and contrast slightly, correct white balance toward neutral. ' +
  'Keep the subject, objects, framing, and composition IDENTICAL to the original. No new elements, no style transfer. ' +
  'Professional photograph quality.';

// Cost table (approximate, USD, 2026-04) — source: Replicate & fal.ai pricing pages.
const COST: Record<string, number> = {
  'flux-kontext-pro':   0.04,
  'flux-kontext-max':   0.08,
  'clarity-upscaler':   0.05,
  'aura-sr':            0.02,
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
  // Poll
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
  throw new Error('Replicate timeout (180s)');
}

async function falRun(endpoint: string, input: Record<string, unknown>): Promise<string> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY missing');
  // fal.ai REST: submit queue + poll
  const submitRes = await fetch(`https://queue.fal.run/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Key ${key}` },
    body:   JSON.stringify(input),
  });
  if (!submitRes.ok) throw new Error(`fal.ai ${endpoint} submit failed: ${submitRes.status} ${await submitRes.text()}`);
  const submit = await submitRes.json() as { request_id: string; status_url?: string; response_url?: string };
  const statusUrl   = submit.status_url   ?? `https://queue.fal.run/${endpoint}/requests/${submit.request_id}/status`;
  const responseUrl = submit.response_url ?? `https://queue.fal.run/${endpoint}/requests/${submit.request_id}`;

  for (let i = 0; i < 90; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const s = await fetch(statusUrl, { headers: { Authorization: `Key ${key}` } });
    const j = await s.json() as { status: string; logs?: unknown };
    if (j.status === 'COMPLETED') {
      const r = await fetch(responseUrl, { headers: { Authorization: `Key ${key}` } });
      const body = await r.json() as { image?: { url: string }; images?: { url: string }[] };
      const url = body.image?.url ?? body.images?.[0]?.url;
      if (!url) throw new Error(`fal.ai ${endpoint} completed but no image url: ${JSON.stringify(body)}`);
      return url;
    }
    if (j.status === 'FAILED') throw new Error(`fal.ai ${endpoint} failed: ${JSON.stringify(j)}`);
  }
  throw new Error('fal.ai timeout');
}

async function downloadAndSave(url: string, localPath: string): Promise<number> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(localPath, buf);
  return buf.length;
}

async function main() {
  // Load manifest
  const manifestPath = resolve(process.cwd(), 'docs/phase3-research/samples/originals/manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as SampleInfo[];

  // Only the 3 gym/pool samples for Camino 2 (exclude burger — that's Camino 3).
  const samples = manifest.filter(s => s.key !== '04-burger-low');

  const outBase = resolve(process.cwd(), 'docs/phase3-research/samples/camino2');
  await mkdir(outBase, { recursive: true });

  const results: Result[] = [];

  for (const sample of samples) {
    const sampleDir = resolve(outBase, sample.key);
    await mkdir(sampleDir, { recursive: true });
    console.log(`\n=== ${sample.key} (${sample.quality}) ===`);

    // -- A. Flux Kontext Pro (baseline) --
    try {
      const t0 = Date.now();
      const outUrl = await replicateRun('black-forest-labs/flux-kontext-pro', {
        prompt:         ENHANCE_PROMPT,
        input_image:    sample.publicUrl,
        output_format:  'jpg',
        guidance:       2,
      });
      const elapsed = (Date.now() - t0) / 1000;
      const local = resolve(sampleDir, 'flux-kontext-pro.jpg');
      const bytes = await downloadAndSave(outUrl, local);
      console.log(`  ✓ flux-kontext-pro  ${elapsed.toFixed(1)}s  ${(bytes/1024).toFixed(0)} KB  ${outUrl}`);
      results.push({ sample: sample.key, model: 'flux-kontext-pro', elapsed_sec: elapsed, cost_usd_est: COST['flux-kontext-pro'], output_url: outUrl, output_local: local, bytes });
    } catch (err) {
      console.log(`  ✗ flux-kontext-pro  ${(err as Error).message}`);
      results.push({ sample: sample.key, model: 'flux-kontext-pro', elapsed_sec: 0, cost_usd_est: COST['flux-kontext-pro'], error: (err as Error).message });
    }

    // -- B. Flux Kontext Max (SKIPPED in this run — budget) --
    // Cost $0.08/run vs $0.04 for Pro; same model family. Pro is the baseline.
    // If Pro underperforms we will re-run with Max.

    // -- C. fal.ai Clarity Upscaler --
    try {
      const t0 = Date.now();
      const outUrl = await falRun('fal-ai/clarity-upscaler', {
        image_url:      sample.publicUrl,
        prompt:         'masterpiece, best quality, highres',
        upscale_factor: 2,
        creativity:     0.35,
        resemblance:    0.6,
      });
      const elapsed = (Date.now() - t0) / 1000;
      const local = resolve(sampleDir, 'clarity-upscaler.jpg');
      const bytes = await downloadAndSave(outUrl, local);
      console.log(`  ✓ clarity-upscaler  ${elapsed.toFixed(1)}s  ${(bytes/1024).toFixed(0)} KB  ${outUrl}`);
      results.push({ sample: sample.key, model: 'clarity-upscaler', elapsed_sec: elapsed, cost_usd_est: COST['clarity-upscaler'], output_url: outUrl, output_local: local, bytes });
    } catch (err) {
      console.log(`  ✗ clarity-upscaler  ${(err as Error).message}`);
      results.push({ sample: sample.key, model: 'clarity-upscaler', elapsed_sec: 0, cost_usd_est: COST['clarity-upscaler'], error: (err as Error).message });
    }

    // -- D. fal.ai Aura-SR --
    try {
      const t0 = Date.now();
      const outUrl = await falRun('fal-ai/aura-sr', {
        image_url:       sample.publicUrl,
        upscaling_factor: 4,
      });
      const elapsed = (Date.now() - t0) / 1000;
      const local = resolve(sampleDir, 'aura-sr.jpg');
      const bytes = await downloadAndSave(outUrl, local);
      console.log(`  ✓ aura-sr          ${elapsed.toFixed(1)}s  ${(bytes/1024).toFixed(0)} KB  ${outUrl}`);
      results.push({ sample: sample.key, model: 'aura-sr', elapsed_sec: elapsed, cost_usd_est: COST['aura-sr'], output_url: outUrl, output_local: local, bytes });
    } catch (err) {
      console.log(`  ✗ aura-sr          ${(err as Error).message}`);
      results.push({ sample: sample.key, model: 'aura-sr', elapsed_sec: 0, cost_usd_est: COST['aura-sr'], error: (err as Error).message });
    }
  }

  // Write results
  const resultsPath = resolve(outBase, 'results.json');
  await writeFile(resultsPath, JSON.stringify({
    prompt: ENHANCE_PROMPT,
    run_at: new Date().toISOString(),
    total_cost_usd_est: results.reduce((a, r) => a + (r.error ? 0 : r.cost_usd_est), 0),
    results,
  }, null, 2));
  console.log(`\nResults written to ${resultsPath}`);
  console.log(`Estimated total cost: $${results.reduce((a, r) => a + (r.error ? 0 : r.cost_usd_est), 0).toFixed(3)}`);
}

main().catch(err => { console.error(err); process.exit(1); });
