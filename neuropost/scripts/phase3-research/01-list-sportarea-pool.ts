#!/usr/bin/env npx tsx
// =============================================================================
// Phase 3.0 research — list SportArea's image pool (step 1.3)
// =============================================================================
// Queries inspiration_unified for images owned by / available to the
// SportArea brand and prints URL + basic metadata. We will manually pick
// 3 representative photos (good / medium / low quality) from the list.
//
// Run: npx tsx --tsconfig tsconfig.json scripts/phase3-research/01-list-sportarea-pool.ts

import { createClient } from '@supabase/supabase-js';
import { config }       from 'dotenv';
import { resolve }      from 'node:path';

config({ path: resolve(process.cwd(), '.env.local') });

const BRAND_ID = process.env.TEST_BRAND_ID ?? 'e8dc77ef-8371-4765-a90c-c7108733f791';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createClient(url, key);

  console.log(`\n--- Inspiration pool for brand ${BRAND_ID} ---\n`);

  // 1. Legacy (brand-owned) references
  const legacy = await supabase
    .from('inspiration_unified')
    .select('id, source, thumbnail_url, media_urls, media_type, tags, mood, created_at')
    .eq('source', 'legacy')
    .eq('brand_id', BRAND_ID)
    .eq('media_type', 'image')
    .order('created_at', { ascending: false })
    .limit(30);

  console.log(`Legacy (brand-owned): ${legacy.data?.length ?? 0} results`);
  for (const row of legacy.data ?? []) {
    const url = (row.thumbnail_url as string | null) ?? (row.media_urls as string[] | null)?.[0] ?? '—';
    console.log(`  [${row.id}] ${url}`);
    console.log(`      tags: ${JSON.stringify(row.tags)}, mood: ${row.mood ?? '—'}`);
  }

  // 2. Bank (global telegram-fed)
  const bank = await supabase
    .from('inspiration_unified')
    .select('id, source, thumbnail_url, media_urls, media_type, tags, mood, category, created_at')
    .eq('source', 'bank')
    .eq('media_type', 'image')
    .not('thumbnail_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`\nBank (global): ${bank.data?.length ?? 0} results (first 10)`);
  for (const row of bank.data ?? []) {
    console.log(`  [${row.id}] ${row.thumbnail_url}`);
    console.log(`      tags: ${JSON.stringify(row.tags)}, category: ${row.category ?? '—'}`);
  }

  // 3. Also check brand_material (photos uploaded by the brand directly)
  const material = await supabase
    .from('brand_material')
    .select('id, file_url, file_type, caption, created_at')
    .eq('brand_id', BRAND_ID)
    .eq('file_type', 'image')
    .order('created_at', { ascending: false })
    .limit(30);

  console.log(`\nbrand_material images: ${material.data?.length ?? 0} results`);
  for (const row of material.data ?? []) {
    console.log(`  [${row.id}] ${row.file_url}`);
    if (row.caption) console.log(`      caption: ${row.caption}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
