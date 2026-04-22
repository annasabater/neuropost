// npx tsx scripts/test-idea-dispatch.ts
import { routeIdea }             from '../src/lib/idea-dispatch';
import type { HumanReviewConfig } from '../src/types';

const allOn:  HumanReviewConfig = {
  messages_create: true,  images_create: true,  videos_create: true,
  messages_regen:  true,  images_regen:  true,  videos_regen:  true,
  requests:        true,
};
const allOff: HumanReviewConfig = {
  messages_create: false, images_create: false, videos_create: false,
  messages_regen:  false, images_regen:  false, videos_regen:  false,
  requests:        false,
};

const base = {
  content_kind:        'post' as const,
  format:              'image' as const,
  suggested_asset_url: null,
  rendered_image_url:  null,
};

type Case = {
  name:          string;
  idea:          Parameters<typeof routeIdea>[0];
  effective:     HumanReviewConfig;
  ctx:           Parameters<typeof routeIdea>[2];
  expect_route:  'worker_review' | 'client_review';
  expect_flag:   'messages_create' | 'images_create' | 'videos_create' | 'messages_regen' | 'images_regen' | 'videos_regen';
};

const cases: Case[] = [
  // ── weekly plan events ─────────────────────────────────────────────────
  { name: '1. weekly plan + messages_create=true',
    idea: base, effective: allOn, ctx: { is_weekly_plan_event: true, is_regeneration: false },
    expect_route: 'worker_review', expect_flag: 'messages_create' },

  { name: '2. weekly plan + messages_create=false',
    idea: base, effective: allOff, ctx: { is_weekly_plan_event: true, is_regeneration: false },
    expect_route: 'client_review', expect_flag: 'messages_create' },

  // ── reel / video (create path) ─────────────────────────────────────────
  { name: '3. reel + videos_create=true (is_regeneration=false)',
    idea: { ...base, format: 'reel' }, effective: allOn, ctx: { is_weekly_plan_event: false, is_regeneration: false },
    expect_route: 'worker_review', expect_flag: 'videos_create' },

  { name: '4. reel + videos_create=false (is_regeneration=false)',
    idea: { ...base, format: 'reel' }, effective: { ...allOn, videos_create: false },
    ctx: { is_weekly_plan_event: false, is_regeneration: false }, expect_route: 'client_review', expect_flag: 'videos_create' },

  // ── reel / video (regen path) ──────────────────────────────────────────
  { name: '5. reel + videos_regen=true (is_regeneration=true)',
    idea: { ...base, format: 'reel' }, effective: allOn, ctx: { is_weekly_plan_event: false, is_regeneration: true },
    expect_route: 'worker_review', expect_flag: 'videos_regen' },

  { name: '6. reel + videos_regen=false (is_regeneration=true)',
    idea: { ...base, format: 'reel' }, effective: { ...allOn, videos_regen: false },
    ctx: { is_weekly_plan_event: false, is_regeneration: true }, expect_route: 'client_review', expect_flag: 'videos_regen' },

  // ── image / carousel (create path) ─────────────────────────────────────
  { name: '7. image + images_create=true (is_regeneration=false)',
    idea: { ...base, format: 'image' }, effective: allOn, ctx: { is_weekly_plan_event: false, is_regeneration: false },
    expect_route: 'worker_review', expect_flag: 'images_create' },

  { name: '8. image + images_create=false (is_regeneration=false)',
    idea: { ...base, format: 'image' }, effective: { ...allOn, images_create: false },
    ctx: { is_weekly_plan_event: false, is_regeneration: false }, expect_route: 'client_review', expect_flag: 'images_create' },

  { name: '9. carousel + images_create=true',
    idea: { ...base, format: 'carousel' }, effective: allOn, ctx: { is_weekly_plan_event: false, is_regeneration: false },
    expect_route: 'worker_review', expect_flag: 'images_create' },

  // ── image / carousel (regen path) ──────────────────────────────────────
  { name: '10. image + images_regen=true (is_regeneration=true)',
    idea: { ...base, format: 'image' }, effective: allOn, ctx: { is_weekly_plan_event: false, is_regeneration: true },
    expect_route: 'worker_review', expect_flag: 'images_regen' },

  { name: '11. image + images_regen=false (is_regeneration=true)',
    idea: { ...base, format: 'image' }, effective: { ...allOn, images_regen: false },
    ctx: { is_weekly_plan_event: false, is_regeneration: true }, expect_route: 'client_review', expect_flag: 'images_regen' },

  // ── text-only fallback ─────────────────────────────────────────────────
  { name: '12. story without asset → text-only fallback (create)',
    idea: { ...base, content_kind: 'story', format: 'story' },
    effective: { ...allOn, messages_create: true, images_create: false },
    ctx: { is_weekly_plan_event: false, is_regeneration: false },
    expect_route: 'worker_review', expect_flag: 'messages_create' },

  { name: '13. story without asset → text-only fallback (regen)',
    idea: { ...base, content_kind: 'story', format: 'story' },
    effective: { ...allOn, messages_regen: false },
    ctx: { is_weekly_plan_event: false, is_regeneration: true },
    expect_route: 'client_review', expect_flag: 'messages_regen' },

  // ── asset wins over format ────────────────────────────────────────────
  { name: '14. post + rendered_image_url present → images (asset wins, create)',
    idea: { ...base, rendered_image_url: 'https://cdn/x.png' },
    effective: { ...allOn, images_create: false },
    ctx: { is_weekly_plan_event: false, is_regeneration: false },
    expect_route: 'client_review', expect_flag: 'images_create' },

  { name: '15. post + suggested_asset_url present → images (asset wins, regen)',
    idea: { ...base, suggested_asset_url: 'https://cdn/y.png' },
    effective: { ...allOn, images_regen: false },
    ctx: { is_weekly_plan_event: false, is_regeneration: true },
    expect_route: 'client_review', expect_flag: 'images_regen' },

  // ── independence of create vs regen flags ─────────────────────────────
  { name: '16. regen reads regen flag only (create=false, regen=true) → worker_review',
    idea: { ...base, format: 'image' },
    effective: { ...allOn, images_create: false, images_regen: true },
    ctx: { is_weekly_plan_event: false, is_regeneration: true },
    expect_route: 'worker_review', expect_flag: 'images_regen' },

  { name: '17. regen reads regen flag only (create=true, regen=false) → client_review',
    idea: { ...base, format: 'image' },
    effective: { ...allOn, images_create: true, images_regen: false },
    ctx: { is_weekly_plan_event: false, is_regeneration: true },
    expect_route: 'client_review', expect_flag: 'images_regen' },
];

let passed = 0, failed = 0;
for (const c of cases) {
  const d = routeIdea(c.idea, c.effective, c.ctx);
  const ok = d.route === c.expect_route && d.flag_checked === c.expect_flag;
  if (ok) { passed++; console.log(`  \u2713 ${c.name}`); }
  else {
    failed++;
    console.error(`  \u2717 ${c.name}`);
    console.error(`      expected: ${c.expect_route} / ${c.expect_flag}`);
    console.error(`      got:      ${d.route} / ${d.flag_checked} \u2014 ${d.reason}`);
  }
}
console.log(`\n${passed}/${cases.length} passed${failed ? `, ${failed} failed` : ''}`);
process.exit(failed ? 1 : 0);
