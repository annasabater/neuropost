#!/usr/bin/env npx tsx
// =============================================================================
// verify-phase2b-new-layouts.ts — Phase 2.B rendering check
// =============================================================================
// Renders each of the 13 new layouts once and confirms they produce a PNG
// without error. Also prints text_mode and preferred_image_source metadata.
//
// Run: npx tsx --tsconfig tsconfig.json scripts/verify-phase2b-new-layouts.ts

import { createHash } from 'node:crypto';
import { renderStory } from '../src/lib/stories/render';
import { LAYOUT_CATALOG } from '../src/lib/stories/layouts-catalog';
import type { Brand, ContentIdea } from '../src/types';

const NEW_LAYOUTS = [
  'photo_fullbleed_clean', 'photo_fullbleed_with_prop',
  'photo_split_top', 'photo_split_bottom', 'photo_corner_text',
  'photo_grid_schedule', 'editorial_large_title', 'minimal_color_block',
  'stat_highlight_clean', 'quote_editorial_serif', 'product_hero_cta',
  'story_numbered_series', 'compare_split',
];

async function main() {
  const mockBrand = {
    id:        '00000000-0000-0000-0000-000000000000',
    user_id:   '00000000-0000-0000-0000-000000000000',
    name:      'TestBrand',
    colors:    { primary: '#0F766E', secondary: '#374151' },
    fonts:     null,
    logo_url:  null,
    overlay_intensity: 'medium',
    sector:    'gym',
    location:  'Cataluña',
    rules:     null,
    hashtags:  [],
    slogans:   [],
    services:  [],
    plan:      'pro',
    created_at: new Date().toISOString(),
  } as unknown as Brand;

  const mockIdea = {
    id:                      '00000000-0000-0000-0000-000000000001',
    brand_id:                mockBrand.id,
    week_id:                 '00000000-0000-0000-0000-000000000002',
    position:                0,
    format:                  'story',
    angle:                   'schedule',
    hook:                    null,
    image_generation_prompt: null,
    copy_draft:              'DL: 9-21\nDT: 9-21\nDC: 9-21\nDJ: 9-21\nDV: 9-21\nDS: 10-14\nDG: tancat',
    hashtags:                null,
    suggested_asset_url:     null,
    suggested_asset_id:      null,
    category_id:             null,
    agent_output_id:         null,
    status:                  'pending',
    content_kind:            'story',
    story_type:              'schedule',
    template_id:             null,
    rendered_image_url:      null,
    generation_fallback:     false,
  } as unknown as ContentIdea;

  const bgUrl = 'https://picsum.photos/seed/phase2b-test/1080/1920';

  console.log(`Phase 2.B: rendering ${NEW_LAYOUTS.length} new layouts`);
  let failed = 0;

  for (const id of NEW_LAYOUTS) {
    const layout = LAYOUT_CATALOG.find(l => l.id === id);
    if (!layout) {
      console.log(`  ✗ ${id}: not in catalog`);
      failed++;
      continue;
    }
    try {
      const needsBg = layout.supportsImage;
      const buf = await renderStory({
        layoutName: id,
        idea: mockIdea,
        brand: mockBrand,
        bgImageUrl: needsBg ? bgUrl : undefined,
      });
      const hash = createHash('md5').update(Buffer.from(buf)).digest('hex');
      console.log(`  ✓ ${id}: ${hash} (text_mode=${layout.text_mode}, source=${layout.preferred_image_source})`);
    } catch (err) {
      console.log(`  ✗ ${id}: render error — ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`\n${NEW_LAYOUTS.length - failed}/${NEW_LAYOUTS.length} new layouts render without errors.`);
  if (failed > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
