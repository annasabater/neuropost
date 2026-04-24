// =============================================================================
// Generate HERO_POSTS images via Replicate and upload to Supabase Storage.
// Run: npx tsx scripts/generate-hero-images.ts
// One-shot: skips any hero-{slug}.jpg already present in the bucket.
// =============================================================================

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN!;
const SUPABASE_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET          = 'hero-images';

if (!REPLICATE_TOKEN) throw new Error('Missing REPLICATE_API_TOKEN');
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Missing Supabase env');

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

type Job = {
  slug:   string;
  sector: string;
  model:  'flux-pro' | 'flux-schnell';
  prompt: string;
};

const JOBS: Job[] = [
  {
    slug:   'restaurante-risotto',
    sector: 'Restaurante',
    model:  'flux-pro',
    prompt: 'Unretouched photograph, creamy saffron risotto served in a shallow white ceramic plate on a wooden restaurant table, shot with Sony A7 IV and 50mm f/1.8 lens, natural window light from the left, visible steam rising, tiny oil droplets, authentic Italian trattoria atmosphere, slightly imperfect grain shapes, real shallow depth of field, subtle crumbs on the table, candid food photograph, no stylized plating, photojournalistic, RAW file look, 35mm film grain',
  },
  {
    slug:   'hotel-vistas',
    sector: 'Hotel',
    model:  'flux-pro',
    prompt: 'Candid interior photograph taken from inside a real boutique hotel room at sunrise, unmade white linen bed in the foreground, open balcony doors leading to a stone terrace with Mediterranean sea view, warm natural sunlight casting long shadows across the floor, slightly messy pillows, a coffee cup on the nightstand, shot on a full-frame DSLR with 24mm lens, realistic soft shadows, authentic travel photography, nothing staged, subtle sensor noise, true-to-life colors',
  },
  {
    slug:   'museo-exposicion',
    sector: 'Museo',
    model:  'flux-pro',
    prompt: 'Elegant contemporary museum gallery with large framed paintings on white walls, warm spotlights, polished concrete floor, a single visitor silhouette observing art, architectural photography, high ceilings, cinematic, sophisticated atmosphere',
  },
  {
    slug:   'gimnasio-clase',
    sector: 'Gimnasio',
    model:  'flux-pro',
    prompt: 'Early morning fitness class in a modern industrial gym, athletic people in black sportswear mid-workout with kettlebells, natural light through large windows, motivational energy, dynamic action shot, high contrast, professional sports photography',
  },
  {
    slug:   'academia-estudiantes',
    sector: 'Academia',
    model:  'flux-pro',
    prompt: 'Bright modern classroom with young adult students engaged in a creative workshop, laptops and notebooks on wooden tables, large windows with natural light, collaborative atmosphere, warm and welcoming, professional education photography',
  },
  {
    slug:   'aventura-senderismo',
    sector: 'Aventura',
    model:  'flux-pro',
    prompt: 'Real photograph of a solo hiker seen from behind walking along a narrow dirt mountain trail in the Pyrenees, wearing a worn grey backpack and faded trekking pants, late afternoon light with long natural shadows, realistic rocks and loose gravel underfoot, wildflowers by the path, distant hazy peaks under a partly cloudy sky, shot on Canon EOS R5 with 35mm lens, natural colors, slightly soft focus on the background, documentary outdoor photography, no HDR, no oversaturation, authentic travel photo',
  },
];

async function runReplicate(model: Job['model'], prompt: string): Promise<string> {
  const endpoint = `https://api.replicate.com/v1/models/black-forest-labs/${model}/predictions`;
  const body =
    model === 'flux-pro'
      ? { input: { prompt, width: 1024, height: 1024, output_format: 'jpg', guidance: 3, prompt_upsampling: false } }
      : { input: { prompt, aspect_ratio: '1:1', output_format: 'jpg', num_outputs: 1, go_fast: true } };

  let res: Response;
  for (let attempt = 0; attempt < 6; attempt++) {
    res = await fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${REPLICATE_TOKEN}` },
      body:    JSON.stringify(body),
    });
    if (res.ok) break;
    if (res.status === 429) {
      const txt = await res.text();
      const m = txt.match(/resets in ~(\d+)s/);
      const waitS = m ? Math.max(parseInt(m[1], 10) + 2, 12) : 15;
      console.log(`   …429, esperando ${waitS}s`);
      await new Promise((r) => setTimeout(r, waitS * 1000));
      continue;
    }
    throw new Error(`Replicate ${model} create failed: ${res.status} ${await res.text()}`);
  }
  if (!res!.ok) throw new Error(`Replicate ${model} create failed after retries`);
  const job = (await res!.json()) as { urls: { get: string } };

  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(job.urls.get, { headers: { Authorization: `Bearer ${REPLICATE_TOKEN}` } });
    const data = (await poll.json()) as { status: string; output?: string[] | string; error?: string };
    if (data.status === 'succeeded') {
      const out = Array.isArray(data.output) ? data.output[0] : data.output;
      if (!out) throw new Error(`${model} returned no output`);
      return out;
    }
    if (data.status === 'failed' || data.status === 'canceled') {
      throw new Error(`Replicate ${model} failed: ${data.error ?? 'unknown'}`);
    }
  }
  throw new Error(`Replicate ${model} timed out`);
}

async function alreadyUploaded(slug: string): Promise<string | null> {
  const path = `${slug}.jpg`;
  const { data } = await supabase.storage.from(BUCKET).list('', { search: path });
  if (!data?.some((f) => f.name === path)) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function uploadFromUrl(slug: string, sourceUrl: string): Promise<string> {
  const res   = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const path  = `${slug}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw new Error(`Upload ${path}: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function main() {
  const results: Array<{ slug: string; sector: string; model: string; url: string; skipped: boolean }> = [];

  for (const job of JOBS) {
    const existing = await alreadyUploaded(job.slug);
    if (existing) {
      console.log(`✓  skip ${job.slug} (already in bucket) — ${job.model}`);
      results.push({ slug: job.slug, sector: job.sector, model: job.model, url: existing, skipped: true });
      continue;
    }
    console.log(`→  ${job.slug} via ${job.model} ...`);
    const t0 = Date.now();
    const genUrl = await runReplicate(job.model, job.prompt);
    const publicUrl = await uploadFromUrl(job.slug, genUrl);
    console.log(`✓  ${job.slug} uploaded in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    console.log(`   ${publicUrl}`);
    results.push({ slug: job.slug, sector: job.sector, model: job.model, url: publicUrl, skipped: false });
  }

  console.log('\n===== RESULTS =====');
  for (const r of results) {
    console.log(`${r.sector.padEnd(13)} | ${r.model.padEnd(12)} | ${r.skipped ? 'skipped' : 'new    '} | ${r.url}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
