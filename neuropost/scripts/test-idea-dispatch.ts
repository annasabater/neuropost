// npx tsx scripts/test-idea-dispatch.ts
import { routeIdea }             from '../src/lib/idea-dispatch';
import type { HumanReviewConfig } from '../src/types';

const allOn:  HumanReviewConfig = { messages: true,  images: true,  videos: true,  requests: true };
const allOff: HumanReviewConfig = { messages: false, images: false, videos: false, requests: false };

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
  expect_flag:   'messages' | 'images' | 'videos';
};

const cases: Case[] = [
  { name: '1. weekly plan + messages=true',
    idea: base, effective: allOn, ctx: { is_weekly_plan_event: true },
    expect_route: 'worker_review', expect_flag: 'messages' },

  { name: '2. weekly plan + messages=false',
    idea: base, effective: allOff, ctx: { is_weekly_plan_event: true },
    expect_route: 'client_review', expect_flag: 'messages' },

  { name: '3. reel + videos=true',
    idea: { ...base, format: 'reel' }, effective: allOn, ctx: { is_weekly_plan_event: false },
    expect_route: 'worker_review', expect_flag: 'videos' },

  { name: '4. reel + videos=false',
    idea: { ...base, format: 'reel' }, effective: { ...allOn, videos: false },
    ctx: { is_weekly_plan_event: false }, expect_route: 'client_review', expect_flag: 'videos' },

  { name: '5. image format + images=true',
    idea: { ...base, format: 'image' }, effective: allOn, ctx: { is_weekly_plan_event: false },
    expect_route: 'worker_review', expect_flag: 'images' },

  { name: '6. image format + images=false',
    idea: { ...base, format: 'image' }, effective: { ...allOn, images: false },
    ctx: { is_weekly_plan_event: false }, expect_route: 'client_review', expect_flag: 'images' },

  { name: '7. carousel + images=true',
    idea: { ...base, format: 'carousel' }, effective: allOn, ctx: { is_weekly_plan_event: false },
    expect_route: 'worker_review', expect_flag: 'images' },

  { name: '8. story without asset → text-only fallback (messages)',
    idea: { ...base, content_kind: 'story', format: 'story' },
    effective: { ...allOn, messages: true, images: false },
    ctx: { is_weekly_plan_event: false },
    expect_route: 'worker_review', expect_flag: 'messages' },

  { name: '9. post + rendered_image_url present → images (asset wins)',
    idea: { ...base, rendered_image_url: 'https://cdn/x.png' },
    effective: { ...allOn, images: false },
    ctx: { is_weekly_plan_event: false },
    expect_route: 'client_review', expect_flag: 'images' },
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
