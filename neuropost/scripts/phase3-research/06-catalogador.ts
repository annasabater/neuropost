#!/usr/bin/env npx tsx
// =============================================================================
// Phase 3.0 — Pool cataloguer benchmark (Claude vision)
// =============================================================================
// For N images we ask the model to return a strict JSON with:
//   content, composition_type, quality, recontextualizable, stands_alone,
//   style_tags, notes.
// We run:
//   - claude-haiku-4-5-20251001  × 3 runs per image (consistency test)
//   - claude-sonnet-4-20250514   × 1 run per image (quality baseline)
//
// Outputs → docs/phase3-research/samples/catalogador/{haiku,sonnet}/{image_key}.json
// plus a summary table in results.md.

import Anthropic from '@anthropic-ai/sdk';
import { config }       from 'dotenv';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { resolve }      from 'node:path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env.local') });

interface PoolImg { key: string; url: string; label: string }

const SYSTEM = `You are an expert photo cataloguer for a social-media brand kit. For each image given you MUST return ONLY a single JSON object, no markdown, no prose before or after. The schema is exactly:

{
  "content": string,                                 // 4-10 words, what the photo shows
  "composition_type": "cenital" | "frontal" | "three_quarters" | "close_up" | "wide" | "detail",
  "quality": { "lighting": 1|2|3|4|5, "sharpness": 1|2|3|4|5, "framing": 1|2|3|4|5 },
  "recontextualizable": boolean,                     // the subject is clear enough to restage
  "stands_alone": boolean,                           // strong enough to use without text overlay
  "style_tags": string[],                            // pick from: warm, cold, moody, bright, minimal, busy, editorial, playful, documentary
  "dominant_colors": string[],                       // up to 3 hex codes
  "notes": string                                    // 1 short sentence, max 120 chars
}

Rules:
- quality: 1 = very poor, 5 = professional.
- recontextualizable = true only if the subject is isolatable (product, person, clear focal point). Crowded scenes with no focal subject = false.
- stands_alone = true only if the image is visually strong enough for IG Story with no copy. Ambiguous / generic stock shots = false.
- Output MUST be valid JSON, no comments, no trailing commas.`;

async function askClaude(model: string, url: string): Promise<{ json: unknown; raw: string; usage: { in: number; out: number } }> {
  const a = new Anthropic();
  const resp = await a.messages.create({
    model,
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'url', url } },
        { type: 'text',  text:   SYSTEM },
      ] as unknown as Anthropic.MessageParam['content'],
    }],
  });
  const raw = resp.content[0].type === 'text' ? resp.content[0].text : '';
  let json: unknown = null;
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    json = match ? JSON.parse(match[0]) : null;
  } catch { json = null; }
  return {
    json,
    raw,
    usage: {
      in:  resp.usage.input_tokens,
      out: resp.usage.output_tokens,
    },
  };
}

// Approximate per-token cost (USD) as of 2026-04, Anthropic pricing page.
const PRICE: Record<string, { in: number; out: number }> = {
  'claude-haiku-4-5-20251001': { in: 1.00 / 1_000_000, out: 5.00  / 1_000_000 },
  'claude-sonnet-4-20250514':  { in: 3.00 / 1_000_000, out: 15.00 / 1_000_000 },
};

function costFor(model: string, u: { in: number; out: number }): number {
  const p = PRICE[model];
  if (!p) return 0;
  return u.in * p.in + u.out * p.out;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createClient(url, key);

  // Build image set: 4 Unsplash samples + 10 bank images (from step 1.3 + query)
  const manifestPath = resolve(process.cwd(), 'docs/phase3-research/samples/originals/manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Array<{ key: string; publicUrl: string; description: string }>;

  const unsplash: PoolImg[] = manifest.map(m => ({ key: m.key, url: m.publicUrl, label: m.description }));

  const bank = await supabase
    .from('inspiration_unified')
    .select('id, thumbnail_url, tags')
    .eq('source', 'bank')
    .eq('media_type', 'image')
    .not('thumbnail_url', 'is', null)
    .limit(10);
  const bankImgs: PoolImg[] = (bank.data ?? []).map((b: { id: string; thumbnail_url: string; tags?: string[] }) => ({
    key:   `bank-${b.id.slice(0, 8)}`,
    url:   b.thumbnail_url,
    label: (b.tags ?? []).slice(0, 3).join(', '),
  }));

  const images = [...unsplash, ...bankImgs];
  console.log(`Cataloguing ${images.length} images`);

  const outBase = resolve(process.cwd(), 'docs/phase3-research/samples/catalogador');
  await mkdir(resolve(outBase, 'haiku'),  { recursive: true });
  await mkdir(resolve(outBase, 'sonnet'), { recursive: true });

  const results: Array<{
    key:     string;
    url:     string;
    model:   string;
    run:     number;
    elapsed: number;
    cost:    number;
    parseOk: boolean;
    json?:   unknown;
  }> = [];

  // Haiku × 3 runs (consistency)
  for (const img of images) {
    for (let run = 1; run <= 3; run++) {
      const t0 = Date.now();
      try {
        const { json, raw, usage } = await askClaude('claude-haiku-4-5-20251001', img.url);
        const elapsed = (Date.now() - t0) / 1000;
        const cost = costFor('claude-haiku-4-5-20251001', usage);
        const parseOk = json !== null;
        await writeFile(resolve(outBase, 'haiku', `${img.key}.run${run}.json`), JSON.stringify({ url: img.url, parsed: json, raw, usage, elapsed, cost }, null, 2));
        console.log(`  haiku  ${img.key} run${run}  ${elapsed.toFixed(1)}s  $${cost.toFixed(5)}  parse=${parseOk ? 'OK' : 'FAIL'}`);
        results.push({ key: img.key, url: img.url, model: 'haiku-4-5', run, elapsed, cost, parseOk, json });
      } catch (err) {
        console.log(`  haiku  ${img.key} run${run}  ERROR ${(err as Error).message}`);
        results.push({ key: img.key, url: img.url, model: 'haiku-4-5', run, elapsed: 0, cost: 0, parseOk: false });
      }
    }
  }

  // Sonnet × 1 run
  for (const img of images) {
    const t0 = Date.now();
    try {
      const { json, raw, usage } = await askClaude('claude-sonnet-4-20250514', img.url);
      const elapsed = (Date.now() - t0) / 1000;
      const cost = costFor('claude-sonnet-4-20250514', usage);
      const parseOk = json !== null;
      await writeFile(resolve(outBase, 'sonnet', `${img.key}.json`), JSON.stringify({ url: img.url, parsed: json, raw, usage, elapsed, cost }, null, 2));
      console.log(`  sonnet ${img.key}        ${elapsed.toFixed(1)}s  $${cost.toFixed(5)}  parse=${parseOk ? 'OK' : 'FAIL'}`);
      results.push({ key: img.key, url: img.url, model: 'sonnet-4', run: 1, elapsed, cost, parseOk, json });
    } catch (err) {
      console.log(`  sonnet ${img.key}        ERROR ${(err as Error).message}`);
      results.push({ key: img.key, url: img.url, model: 'sonnet-4', run: 1, elapsed: 0, cost: 0, parseOk: false });
    }
  }

  const summary = {
    total_images: images.length,
    total_cost_usd: results.reduce((a, r) => a + r.cost, 0),
    haiku: {
      runs: results.filter(r => r.model === 'haiku-4-5').length,
      parseOk: results.filter(r => r.model === 'haiku-4-5' && r.parseOk).length,
      avgElapsed: results.filter(r => r.model === 'haiku-4-5').reduce((a, r) => a + r.elapsed, 0) / Math.max(1, results.filter(r => r.model === 'haiku-4-5').length),
      totalCost: results.filter(r => r.model === 'haiku-4-5').reduce((a, r) => a + r.cost, 0),
    },
    sonnet: {
      runs: results.filter(r => r.model === 'sonnet-4').length,
      parseOk: results.filter(r => r.model === 'sonnet-4' && r.parseOk).length,
      avgElapsed: results.filter(r => r.model === 'sonnet-4').reduce((a, r) => a + r.elapsed, 0) / Math.max(1, results.filter(r => r.model === 'sonnet-4').length),
      totalCost: results.filter(r => r.model === 'sonnet-4').reduce((a, r) => a + r.cost, 0),
    },
  };
  await writeFile(resolve(outBase, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log('\n--- summary ---');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
