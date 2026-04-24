#!/usr/bin/env npx tsx
// =============================================================================
// Phase 3.0 — inspect real outputs of editImage() in production
// =============================================================================
// Queries posts/post_revisions tables for rows where the brief mode was
// 'img2img' (so Flux Kontext Pro ran). Produces a small report of
// (original_url, edited_url, prompt, created_at). We then pick 3-5 for
// visual inspection.

import { createClient } from '@supabase/supabase-js';
import { config }       from 'dotenv';
import { resolve }      from 'node:path';

config({ path: resolve(process.cwd(), '.env.local') });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createClient(url, key);

  // post_revisions is the audit trail
  console.log('\n--- post_revisions with img2img ---\n');
  const { data: revs, error: errRevs } = await supabase
    .from('post_revisions')
    .select('id, post_id, brand_id, revision_index, model, strength, guidance, prompt, image_url, brief_snapshot, created_at')
    .not('image_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50);

  if (errRevs) {
    console.error('revisions error:', errRevs);
  } else {
    console.log(`Total revisions with image_url: ${revs?.length ?? 0}`);
    let kontextCount = 0;
    for (const r of revs ?? []) {
      const isKontext = r.model === 'flux-kontext-pro';
      if (isKontext) {
        kontextCount++;
        const brief = r.brief_snapshot as { primary_image_url?: string } | null;
        if (kontextCount <= 10) {
          console.log(`\n[${r.id}]`);
          console.log(`  original:  ${brief?.primary_image_url ?? '—'}`);
          console.log(`  edited:    ${r.image_url}`);
          console.log(`  model:     ${r.model}  strength=${r.strength}  guidance=${r.guidance}`);
          console.log(`  prompt:    ${(r.prompt ?? '').slice(0, 180)}`);
          console.log(`  created:   ${r.created_at}`);
        }
      }
    }
    console.log(`\nTotal flux-kontext-pro revisions: ${kontextCount}`);

    // Dump all revisions (regardless of model) for the record
    console.log('\n--- ALL revisions (any model) ---');
    for (const r of revs ?? []) {
      console.log(`  [${r.id}] model=${r.model}  image_url=${r.image_url}  created=${r.created_at}`);
    }
  }

  // Also inspect bucket directly
  console.log('\n--- Supabase Storage: assets/edited/ ---\n');
  const { data: files, error: errBucket } = await supabase
    .storage
    .from('assets')
    .list('edited', { limit: 20, sortBy: { column: 'created_at', order: 'desc' } });

  if (errBucket) {
    console.error('bucket error:', errBucket);
  } else {
    console.log(`Recent files in assets/edited/: ${files?.length ?? 0}`);
    for (const f of files ?? []) {
      const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(`edited/${f.name}`);
      console.log(`  ${f.name}  (${f.metadata?.size ?? '?'} B)  → ${publicUrl}`);
    }
  }

  console.log('\n--- Supabase Storage: posts/edited/ ---\n');
  const { data: files2, error: err2 } = await supabase
    .storage
    .from('posts')
    .list('edited', { limit: 20, sortBy: { column: 'created_at', order: 'desc' } });
  if (err2) {
    console.error('bucket posts/ error:', err2);
  } else {
    console.log(`Recent files in posts/edited/: ${files2?.length ?? 0}`);
    for (const f of files2 ?? []) {
      const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(`edited/${f.name}`);
      console.log(`  ${f.name}  (${f.metadata?.size ?? '?'} B)  → ${publicUrl}`);
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
