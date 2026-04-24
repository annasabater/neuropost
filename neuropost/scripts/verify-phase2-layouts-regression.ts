#!/usr/bin/env npx tsx
// =============================================================================
// verify-phase2-layouts-regression.ts — Phase 2.A no-regression check
// =============================================================================
// Renders the 12 original layouts and prints their MD5 hashes.
// Must be run pre- and post- the registry refactor; hashes must match byte-for-byte.
//
// Run: npx tsx --tsconfig tsconfig.json scripts/verify-phase2-layouts-regression.ts
// Writes hashes to stdout AND to a file (first arg, default /tmp/phase2a-hashes.txt).

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { renderStory } from '../src/lib/stories/render';
import type { ContentIdea, Brand } from '../src/types';

const EXISTING = [
  'centered', 'minimal', 'table', 'hero', 'banner',
  'urgent', 'stat', 'tagline', 'overlay', 'flexible',
  'photo_overlay', 'photo_schedule',
];

const mockBrand = {
  id:        '00000000-0000-0000-0000-000000000000',
  user_id:   '00000000-0000-0000-0000-000000000000',
  name:      'TestBrand',
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

const bgUrl = 'https://picsum.photos/seed/regression-test/1080/1920';

async function hashRender(layoutName: string, withBg: boolean): Promise<string> {
  const buf = await renderStory({
    layoutName,
    idea: mockIdea,
    brand: mockBrand,
    bgImageUrl: withBg ? bgUrl : undefined,
  });
  return createHash('md5').update(Buffer.from(buf)).digest('hex');
}

async function main() {
  const outPath = process.argv[2] ?? '/tmp/phase2a-hashes.txt';
  console.log('Phase 2.A no-regression test: hashing all 12 existing layouts');
  const lines: string[] = [];
  for (const layout of EXISTING) {
    const needsBg = ['photo_overlay', 'photo_schedule'].includes(layout);
    const hash = await hashRender(layout, needsBg);
    const line = `${layout}: ${hash}`;
    console.log(`  ${line}`);
    lines.push(line);
  }

  writeFileSync(outPath, lines.join('\n') + '\n');
  console.log(`\n12 layouts rendered without errors via registry dispatch.`);
  console.log(`Hashes written to ${outPath}.`);
}

main().catch(err => { console.error(err); process.exit(1); });
