#!/usr/bin/env npx tsx
// =============================================================================
// verify-phase0-fonts.ts — Phase 0.C acceptance check
// =============================================================================
// Renders a story 3 times with different brand.fonts values and confirms:
//   Test 1: brand.fonts = null              → renders OK with fallback
//   Test 2: brand.fonts = {Playfair, Inter} → produces a DIFFERENT hash from Test 1
//   Test 3: brand.fonts = {invalid ids}     → same hash as Test 1 (fallback engaged)
//
// Run: npx tsx --tsconfig tsconfig.json scripts/verify-phase0-fonts.ts
// Exits 0 on pass, 1 on fail.

import { createHash } from 'node:crypto';
import { renderStory } from '../src/lib/stories/render';
import type { ContentIdea, Brand } from '../src/types';

const mockBrand = {
  id:        '00000000-0000-0000-0000-000000000000',
  user_id:   '00000000-0000-0000-0000-000000000000',
  name:      'SportArea',
  colors:    { primary: '#0F766E', secondary: '#374151' },
  fonts:     null,
  logo_url:  null,
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
  copy_draft:              'Lunes: 9:00-21:00\nSábado: 10:00-14:00',
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

async function render(fonts: { heading?: string; body?: string } | null): Promise<string> {
  const brand = { ...mockBrand, fonts } as unknown as Brand;
  const buf = await renderStory({ layoutName: 'table', idea: mockIdea, brand });
  return createHash('md5').update(Buffer.from(buf)).digest('hex');
}

async function main() {
  console.log('Test 1: brand.fonts = null (fallback to Barlow / Barlow Condensed)');
  const hashA = await render(null);
  console.log(`  MD5: ${hashA}`);

  console.log('\nTest 2: brand.fonts = {heading: playfair_display, body: inter}');
  const hashB = await render({ heading: 'playfair_display', body: 'inter' });
  console.log(`  MD5: ${hashB}`);

  if (hashA === hashB) {
    console.error('\nFAIL: Test 1 and Test 2 produced identical PNG — custom fonts not applied.');
    process.exit(1);
  }

  console.log('\nTest 3: brand.fonts = {heading: nonexistent, body: fake} (fallback engaged)');
  const hashC = await render({ heading: 'nonexistent', body: 'fake' });
  console.log(`  MD5: ${hashC}`);

  if (hashC !== hashA) {
    console.error('\nFAIL: Test 3 did not match Test 1 — invalid font ids did not fall back.');
    process.exit(1);
  }

  console.log('\n\u2713 All 3 font-rendering tests passed.');
  console.log(`  fallback:   ${hashA}`);
  console.log(`  custom:     ${hashB}`);
  console.log(`  invalid-fb: ${hashC}`);
}

main().catch(err => { console.error(err); process.exit(1); });
