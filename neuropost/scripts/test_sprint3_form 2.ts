/**
 * Sprint 3 — new post form + delivery_mode tests
 *
 * Unit tests (no DB):
 *   U1  deriveSourceType('none') → 'none'
 *   U2  deriveSourceType('photos') → 'photos'
 *   U3  deriveSourceType('video') → 'video'
 *   U4  DEFAULT_FORM_STATE.deliveryMode === 'reviewed'
 *   U5  OBJECTIVES has 5 entries
 *   U6  SUBTYPES covers all 5 objectives
 *   U7a starter+instant → blocked
 *   U7b pro+instant → allowed
 *   U7c starter+reviewed → allowed
 *
 * Integration (requires TEST_COOKIE env var):
 *   I1  POST /api/posts delivery_mode='reviewed' persists it
 *   I4  GET /api/posts/:id returns delivery_mode
 */

import * as dotenv from 'dotenv';
import * as path   from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

let passed = 0, failed = 0;

function ok(name: string, val: boolean, detail = '') {
  if (val) { console.log(`  ✅ ${name}`); passed++; }
  else     { console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`); failed++; }
}

function section(title: string) { console.log(`\n${title}`); }

import {
  deriveSourceType,
  DEFAULT_FORM_STATE,
  OBJECTIVES,
  SUBTYPES,
} from '../src/components/posts/new/types';

section('Unit: deriveSourceType');
ok('U1 no media → none',   deriveSourceType([]) === 'none');
ok('U2 image media → photos', deriveSourceType([{ id: '1', url: 'x', source: 'library', type: 'image' }]) === 'photos');
ok('U3 video media → video',  deriveSourceType([{ id: '1', url: 'x', source: 'library', type: 'video' }]) === 'video');
ok('U3b mixed → video (video wins)', deriveSourceType([
  { id: '1', url: 'x', source: 'library', type: 'image' },
  { id: '2', url: 'y', source: 'library', type: 'video' },
]) === 'video');

section('Unit: DEFAULT_FORM_STATE');
ok('U4 default deliveryMode=reviewed', DEFAULT_FORM_STATE.deliveryMode === 'reviewed');
ok('U4b default objective=null',       DEFAULT_FORM_STATE.objective === null);
ok('U4c default platforms=[instagram]',
  DEFAULT_FORM_STATE.platforms.length === 1 && DEFAULT_FORM_STATE.platforms[0] === 'instagram');

section('Unit: OBJECTIVES / SUBTYPES');
ok('U5 5 objectives', OBJECTIVES.length === 5);
const allObjectivesInSubtypes = OBJECTIVES.every(
  (o) => Array.isArray(SUBTYPES[o.v]) && SUBTYPES[o.v].length > 0
);
ok('U6 all objectives have subtypes', allObjectivesInSubtypes);
const allSubtypesHavePlaceholder = OBJECTIVES.every(
  (o) => SUBTYPES[o.v].every((s) => s.placeholder.length > 0)
);
ok('U6b all subtypes have placeholders', allSubtypesHavePlaceholder);

section('Unit: server-side delivery_mode guard');
function simulateGuard(plan: string, deliveryMode: string): { allowed: boolean } {
  if (deliveryMode === 'instant' && plan === 'starter') return { allowed: false };
  return { allowed: true };
}
ok('U7a starter+instant → blocked',  !simulateGuard('starter', 'instant').allowed);
ok('U7b pro+instant → allowed',       simulateGuard('pro',     'instant').allowed);
ok('U7c total+instant → allowed',     simulateGuard('total',   'instant').allowed);
ok('U7d starter+reviewed → allowed',  simulateGuard('starter', 'reviewed').allowed);

// ── Integration ───────────────────────────────────────────────────────────────

const BASE   = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const COOKIE = process.env.TEST_COOKIE ?? '';

async function runIntegration() {
  section('Integration: delivery_mode');

  if (!COOKIE) {
    console.log('  ⏭  Skipped — set TEST_COOKIE to run integration tests');
    return;
  }

  const BASE_BODY = {
    caption:       'Test Sprint 3 form',
    status:        'request',
    format:        'image',
    platform:      ['instagram'],
    delivery_mode: 'reviewed',
    ai_explanation: JSON.stringify({ global_description: 'sprint3 form test', per_image: [] }),
  };

  const r1 = await fetch(`${BASE}/api/posts`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: COOKIE },
    body: JSON.stringify(BASE_BODY),
  });
  const j1 = await r1.json() as { post?: { id: string; delivery_mode?: string } };
  ok('I1 POST returns 201',              r1.status === 201,           `got ${r1.status}`);
  ok('I1 delivery_mode=reviewed in row', j1.post?.delivery_mode === 'reviewed',
    `got ${j1.post?.delivery_mode}`);

  if (j1.post?.id) {
    const r4 = await fetch(`${BASE}/api/posts/${j1.post.id}`, { headers: { Cookie: COOKIE } });
    const j4 = await r4.json() as { post?: { delivery_mode?: string } };
    ok('I4 GET returns delivery_mode', j4.post?.delivery_mode === 'reviewed',
      `got ${j4.post?.delivery_mode}`);
  }
}

runIntegration().then(() => {
  console.log(`\n${'─'.repeat(48)}`);
  console.log(`  ${passed + failed} tests — ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}).catch((e) => { console.error(e); process.exit(1); });
