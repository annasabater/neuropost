#!/usr/bin/env npx tsx
// =============================================================================
// Phase 3.0 — download 4 representative photos from Unsplash
// =============================================================================
// Saves the originals to docs/phase3-research/samples/originals/ with stable
// filenames so later experiments can reference them. Also publishes them to
// Supabase Storage (bucket: assets/phase3-research/) so image APIs (Flux
// Kontext, fal.ai) can fetch them by URL — most providers require a
// public URL, not a local file.
//
// Photos chosen:
//   01-piscina-good    → good quality: indoor pool, pro shot
//   02-gym-medium      → medium quality: weight machine, uneven light
//   03-funcional-low   → low quality: functional zone, phone-style
//   04-burger-low      → burger phone-photo (case study)
//
// Run: npx tsx --tsconfig tsconfig.json scripts/phase3-research/03-fetch-unsplash-samples.ts

import { createClient } from '@supabase/supabase-js';
import { config }       from 'dotenv';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve }      from 'node:path';

config({ path: resolve(process.cwd(), '.env.local') });

// Unsplash direct image URLs. Photo IDs chosen manually to match the four
// quality tiers. Using the images.unsplash.com CDN with fixed w=1600 so file
// sizes stay modest.
interface Sample {
  key:          string;
  description:  string;
  quality:      'good' | 'medium' | 'low';
  sourceUrl:    string;
  credit:       string;   // Unsplash attribution
}

const SAMPLES: Sample[] = [
  {
    key:         '01-piscina-good',
    description: 'Indoor swimming pool, wide shot, professional architectural lighting. Clear subject, clean composition. Represents a "pool photo in good condition".',
    quality:     'good',
    // "Swimming pool" by Val Tievsky
    sourceUrl:   'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=1600&q=80&auto=format&fit=crop',
    credit:      'Photo by Val Tievsky on Unsplash',
  },
  {
    key:         '02-gym-medium',
    description: 'Gym interior with weight machines, mixed natural+artificial light. Medium quality: subject readable but lighting uneven.',
    quality:     'medium',
    sourceUrl:   'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1600&q=80&auto=format&fit=crop',
    credit:      'Photo by Danielle Cerullo on Unsplash',
  },
  {
    key:         '03-funcional-low',
    description: 'Crossfit / functional training zone, shot from floor level, slightly motion-blurred, phone-style framing. Low quality baseline for Camino 2 stress test.',
    quality:     'low',
    sourceUrl:   'https://images.unsplash.com/photo-1599058917212-d750089bc07e?w=1600&q=80&auto=format&fit=crop',
    credit:      'Photo by John Arano on Unsplash',
  },
  {
    key:         '04-burger-low',
    description: 'Cheeseburger close-up, casual restaurant lighting, phone-style shot. Represents the "client sends burger photo via WhatsApp" scenario for Camino 3.',
    quality:     'low',
    sourceUrl:   'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1600&q=80&auto=format&fit=crop',
    credit:      'Photo by Mae Mu on Unsplash',
  },
];

async function main() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key     = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createClient(url, key);

  const outDir = resolve(process.cwd(), 'docs/phase3-research/samples/originals');
  await mkdir(outDir, { recursive: true });

  console.log(`Downloading ${SAMPLES.length} Unsplash samples to ${outDir}\n`);

  const manifest: Array<Sample & { localPath: string; publicUrl: string; bytes: number }> = [];

  for (const sample of SAMPLES) {
    process.stdout.write(`  ${sample.key} … `);
    const res = await fetch(sample.sourceUrl);
    if (!res.ok) {
      console.log(`FAIL ${res.status}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const localPath = resolve(outDir, `${sample.key}.jpg`);
    await writeFile(localPath, buf);

    // Upload to Supabase Storage so APIs can fetch by URL. Use the `posts`
    // bucket (public) since no dedicated `assets` bucket exists in this project.
    const storagePath = `phase3-research/originals/${sample.key}.jpg`;
    const { error: upErr } = await supabase.storage
      .from('posts')
      .upload(storagePath, buf, { contentType: 'image/jpeg', upsert: true });
    if (upErr) {
      console.log(`STORAGE ERROR ${upErr.message}`);
    }
    const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(storagePath);

    manifest.push({ ...sample, localPath, publicUrl, bytes: buf.length });
    console.log(`${(buf.length / 1024).toFixed(0)} KB  →  ${publicUrl}`);
  }

  const manifestPath = resolve(outDir, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest written to ${manifestPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });
