// =============================================================================
// Generate PORTFOLIO (8) + SECTORS (12) images with flux-1.1-pro.
// Uploads to supabase `hero-images` bucket. Idempotent: skips existing files.
// Run: npx tsx scripts/generate-portfolio-sectors.ts
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
const MODEL           = 'black-forest-labs/flux-1.1-pro';

if (!REPLICATE_TOKEN) throw new Error('Missing REPLICATE_API_TOKEN');
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

type Job = { slug: string; group: string; prompt: string };

const JOBS: Job[] = [
  // ─── PORTFOLIO (8) ─────────────────────────────────────────────────────────
  {
    slug: 'portfolio-restaurante',
    group: 'PORTFOLIO',
    prompt: 'Real photograph of a beautifully set restaurant table at golden hour, neutral linen tablecloth, two wine glasses catching warm light, bread basket, olive oil, candle flickering, plate of fresh tapas with jamón and olives, blurred dining room in background with other couples, shot on Sony A7 IV 50mm f/1.8, natural imperfections, candid editorial photography',
  },
  {
    slug: 'portfolio-hotel',
    group: 'PORTFOLIO',
    prompt: 'Real photograph of a boutique hotel reception check-in desk, polished wood counter with hotel bell and fresh flowers in a vase, concierge smiling subtly (out of focus in background), warm pendant lighting, guest keycard envelope on the desk, authentic travel photography, shot on Canon EOS R5 35mm, natural colors, documentary style',
  },
  {
    slug: 'portfolio-unas',
    group: 'PORTFOLIO',
    prompt: 'Real photograph of a professional nail salon manicure station, closeup of hands receiving a french manicure, nail technician hands visible, natural light from the window, pastel polish bottles nearby, soft towel, authentic beauty photography, shallow depth of field, realistic skin texture, shot on Nikon Z8 85mm, no retouching',
  },
  {
    slug: 'portfolio-dental',
    group: 'PORTFOLIO',
    prompt: 'Real photograph of a modern dental clinic reception area, bright clean minimalist interior with pale wood and white tones, smiling patient at the counter with the dental hygienist (both out of focus in the background), a small potted plant on the counter, natural soft lighting, reassuring professional atmosphere, documentary healthcare photography, shot on full-frame 35mm, no overexposure',
  },
  {
    slug: 'portfolio-floristeria',
    group: 'PORTFOLIO',
    prompt: 'Real photograph inside a small artisan flower shop, hands of a florist arranging a bouquet of peonies and eucalyptus on a wooden workbench, wrapping paper, scissors and twine visible, warm afternoon sunlight through the shop window, realistic soft shadows, candid small-business photography, shot on Fujifilm X-T5 35mm, natural colors, no staging',
  },
  {
    slug: 'portfolio-aventura',
    group: 'PORTFOLIO',
    prompt: 'Real photograph of a mountain biker mid-ride on a forest singletrack trail, authentic motion blur on the wheels, dappled sunlight through the pine trees, dust kicked up, mud on the tires, candid outdoor sports photography, shot on Sony A1 70-200mm f/2.8, natural colors, documentary feel, no oversaturation',
  },
  {
    slug: 'portfolio-cocteleria',
    group: 'PORTFOLIO',
    prompt: 'Real photograph of a craft cocktail bar at night, bartender\'s hands pouring an amber negroni into a rocks glass with a large ice cube and orange peel, warm amber lights, shelves of vintage bottles in the soft-focus background, polished dark wood bar, condensation on the glass, authentic nightlife photography, shot on Leica Q3 28mm f/1.7, cinematic, no HDR',
  },
  {
    slug: 'portfolio-eventos',
    group: 'PORTFOLIO',
    prompt: 'Real photograph of an elegant outdoor wedding reception at dusk, long banquet table with hanging bulb string lights overhead, white tablecloth, wildflower centerpieces, wine glasses, out-of-focus guests laughing in the background, golden hour warmth, candid event photography, shot on Canon R5 85mm f/1.4, natural grain, authentic celebration atmosphere',
  },

  // ─── SECTORS (12) ──────────────────────────────────────────────────────────
  {
    slug: 'sector-restaurantes',
    group: 'SECTORS',
    prompt: 'Real photograph of a Spanish tapas restaurant interior from eye level, crowded small round tables with plates of patatas bravas, croquetas and jamón ibérico, glasses of tinto de verano, warm pendant lights overhead, blurred diners chatting, authentic vibrant neighborhood atmosphere, shot on 35mm, documentary style, natural colors',
  },
  {
    slug: 'sector-hoteles',
    group: 'SECTORS',
    prompt: 'Real photograph of a rooftop hotel swimming pool at sunset, turquoise water reflecting warm orange sky, white sun loungers with folded towels, a few guests in the water out of focus, city skyline in background, authentic travel photography, shot on full-frame 24mm, no oversaturation',
  },
  {
    slug: 'sector-museos',
    group: 'SECTORS',
    prompt: 'Real photograph inside a classical sculpture gallery, a tall marble statue in the center frame with warm accent lighting, polished stone floor, visitors viewing sculptures in the background out of focus, soft museum light, architectural photography, shot on Canon R5 24-70mm, natural tones',
  },
  {
    slug: 'sector-academias',
    group: 'SECTORS',
    prompt: 'Real photograph of a bright modern co-working study space, a woman in her thirties with a laptop and an open textbook taking notes, large window with soft diffused light, coffee mug and highlighter on the desk, other students blurred in the background, authentic education photography, shot on 50mm f/1.8',
  },
  {
    slug: 'sector-deporte',
    group: 'SECTORS',
    prompt: 'Real photograph of a rock climber on a limestone cliff face, chalk on hands, climbing rope, helmet and harness visible, dramatic natural rock texture, late afternoon light, realistic muscle strain and expression, candid outdoor sports photography, shot on telephoto 200mm, documentary style',
  },
  {
    slug: 'sector-tiendas',
    group: 'SECTORS',
    prompt: 'Real photograph inside a boutique fashion store, minimalist interior with wooden clothing racks, neatly folded linen shirts and draped dresses, brass hangers, a full-length mirror, warm pendant lights, authentic retail photography, shot on 35mm, natural color palette, no staging',
  },
  {
    slug: 'sector-salud',
    group: 'SECTORS',
    prompt: 'Real photograph of a spa treatment room, closeup of a person receiving a relaxing back massage with warm stones, soft candlelight, white towels, bamboo decor elements, dimmed ambient lighting, authentic wellness photography, shot on 50mm f/1.4, shallow depth of field, calm atmosphere',
  },
  {
    slug: 'sector-inmobiliarias',
    group: 'SECTORS',
    prompt: 'Real photograph of a modern minimalist living room, wide-angle view showing a grey linen sofa with throw pillows, wooden coffee table with a book, large windows with natural light flooding in, white walls, potted fiddle-leaf fig, authentic real estate photography, shot on 16mm ultra-wide, no HDR, realistic shadows',
  },
  {
    slug: 'sector-cafeterias',
    group: 'SECTORS',
    prompt: 'Real photograph of a barista pulling an espresso shot at a specialty coffee bar, steam rising from the portafilter, blurred customer ordering in the background, exposed brick wall, vintage espresso machine, condensation on cold brew glass nearby, candid café photography, shot on Sony A7 IV 35mm, natural colors',
  },
  {
    slug: 'sector-ocio-familiar',
    group: 'SECTORS',
    prompt: 'Real photograph of a family of four at a local amusement park on a summer afternoon, kids laughing on a carousel, parents watching and smiling, warm natural light, motion blur on the carousel, candid unposed moment, authentic lifestyle photography, shot on 85mm f/1.8, documentary style',
  },
  {
    slug: 'sector-eventos',
    group: 'SECTORS',
    prompt: 'Real photograph of an elegant corporate gala event, large ballroom with round tables set with white linens and centerpieces, chandeliers overhead, guests in formal attire mingling out of focus, warm ambient light, subtle stage in the background, authentic event photography, shot on full-frame 35mm',
  },
  {
    slug: 'sector-mas',
    group: 'SECTORS',
    prompt: 'Real photograph of a bustling local artisan market on a sunny weekend, stalls with handmade ceramics, bread, flowers and textiles, people browsing and chatting, warm natural daylight, soft motion, authentic candid market photography, shot on Fujifilm X-T5 23mm, natural colors, no saturation boost',
  },
];

async function runReplicate(prompt: string): Promise<string> {
  const endpoint = `https://api.replicate.com/v1/models/${MODEL}/predictions`;
  const body = { input: { prompt, aspect_ratio: '1:1', output_format: 'jpg', safety_tolerance: 2, prompt_upsampling: false } };

  let res: Response;
  for (let attempt = 0; attempt < 8; attempt++) {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${REPLICATE_TOKEN}` },
      body: JSON.stringify(body),
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
    throw new Error(`Replicate create failed: ${res.status} ${await res.text()}`);
  }
  if (!res!.ok) throw new Error('Replicate create failed after retries');
  const job = (await res!.json()) as { urls: { get: string } };

  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(job.urls.get, { headers: { Authorization: `Bearer ${REPLICATE_TOKEN}` } });
    const data = (await poll.json()) as { status: string; output?: string[] | string; error?: string };
    if (data.status === 'succeeded') {
      const out = Array.isArray(data.output) ? data.output[0] : data.output;
      if (!out) throw new Error('no output');
      return out;
    }
    if (data.status === 'failed' || data.status === 'canceled') throw new Error(`failed: ${data.error}`);
  }
  throw new Error('timeout');
}

async function alreadyUploaded(slug: string): Promise<string | null> {
  const path = `${slug}.jpg`;
  const { data } = await supabase.storage.from(BUCKET).list('', { search: path });
  if (!data?.some((f) => f.name === path)) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function uploadFromUrl(slug: string, sourceUrl: string): Promise<string> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`download ${slug}: ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const { error } = await supabase.storage.from(BUCKET).upload(`${slug}.jpg`, bytes, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw new Error(`upload ${slug}: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(`${slug}.jpg`).data.publicUrl;
}

async function main() {
  const out: Array<{ slug: string; group: string; url: string; skipped: boolean }> = [];
  for (const job of JOBS) {
    const existing = await alreadyUploaded(job.slug);
    if (existing) {
      console.log(`✓  skip ${job.slug}`);
      out.push({ slug: job.slug, group: job.group, url: existing, skipped: true });
      continue;
    }
    console.log(`→  ${job.slug} ...`);
    const t0 = Date.now();
    const gen = await runReplicate(job.prompt);
    const url = await uploadFromUrl(job.slug, gen);
    console.log(`✓  ${job.slug} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    out.push({ slug: job.slug, group: job.group, url, skipped: false });
  }
  console.log('\n===== RESULTS =====');
  for (const r of out) {
    console.log(`${r.group} | ${r.slug.padEnd(28)} | ${r.skipped ? 'skipped' : 'new    '} | ${r.url}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
