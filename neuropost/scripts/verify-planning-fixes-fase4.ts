#!/usr/bin/env npx tsx
// =============================================================================
// verify-planning-fixes-fase4.ts — static code checks for Fase 4.A
// =============================================================================
// Checks: P14 (audit logs), P19 (schedule guard), P21 (Sentry hooks)
// No runtime DB calls — purely grep-based static analysis.
//
// Run: npx tsx --tsconfig tsconfig.json scripts/verify-planning-fixes-fase4.ts

import * as fs from 'fs';
import * as path from 'path';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');

function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

function countOccurrences(content: string, pattern: string | RegExp): number {
  const re = typeof pattern === 'string'
    ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
    : new RegExp(pattern.source, 'g');
  return (content.match(re) ?? []).length;
}

interface CheckResult {
  name:    string;
  passed:  boolean;
  detail?: string;
}

const results: CheckResult[] = [];

function check(name: string, passed: boolean, detail?: string) {
  results.push({ name, passed, detail });
}

// ─── P19: schedule guard in plan-stories.ts ──────────────────────────────────

const planStories = readFile('src/lib/agents/stories/plan-stories.ts');

check(
  'P19 — schedule guard filters validDays',
  planStories.includes('validDays') && planStories.includes('typeof d.day === \'string\''),
  'Expected: validDays filter with typeof check in schedule case',
);

check(
  'P19 — logs schedule_material_malformed',
  planStories.includes('schedule_material_malformed'),
  'Expected: log event schedule_material_malformed when elements are rejected',
);

check(
  'P19 — imports log in plan-stories.ts',
  planStories.includes("from '@/lib/logger'"),
  'Expected: import { log } from @/lib/logger',
);

// ─── P14: logAgentAction in plan-week.ts ─────────────────────────────────────

const planWeek = readFile('src/lib/agents/strategy/plan-week.ts');

const agentActionCalls = countOccurrences(planWeek, 'logAgentAction(');
check(
  `P14 — plan-week.ts has ≥4 logAgentAction calls (found ${agentActionCalls})`,
  agentActionCalls >= 4,
  'Expected: plan_created, plan_completed, plan_failed (P10 guard), plan_failed (concurrent), plan_failed (generic)',
);

check(
  'P14 — plan-week.ts imports logAgentAction',
  planWeek.includes("from '@/lib/audit'"),
  'Expected: import { logAgentAction } from @/lib/audit',
);

// ─── P14: logAudit in HTTP routes ────────────────────────────────────────────

const routesToCheck: [string, string][] = [
  ['src/app/api/worker/weekly-plans/[id]/approve/route.ts', 'approve route'],
  ['src/app/api/worker/weekly-plans/[id]/reject/route.ts',  'reject route'],
  ['src/app/api/client/weekly-plans/[id]/confirm/route.ts', 'confirm route'],
  ['src/app/api/client/weekly-plans/[id]/ideas/[ideaId]/route.ts', 'ideas PATCH route'],
];

for (const [filePath, label] of routesToCheck) {
  const content = readFile(filePath);
  check(
    `P14 — ${label} imports logAudit`,
    content.includes("from '@/lib/audit'"),
    `Expected: import logAudit from @/lib/audit in ${filePath}`,
  );
  check(
    `P14 — ${label} calls logAudit(...)`,
    content.includes('logAudit('),
    `Expected: logAudit call in ${filePath}`,
  );
}

// ─── P14: logSystemAction in crons ───────────────────────────────────────────

const cronsToCheck: [string, string][] = [
  ['src/app/api/cron/reconcile-renders/route.ts',       'reconcile-renders cron'],
  ['src/app/api/cron/reconcile-client-emails/route.ts', 'reconcile-client-emails cron'],
  ['src/app/api/cron/detect-stuck-plans/route.ts',      'detect-stuck-plans cron'],
];

for (const [filePath, label] of cronsToCheck) {
  const content = readFile(filePath);
  check(
    `P14 — ${label} calls logSystemAction(...)`,
    content.includes('logSystemAction('),
    `Expected: logSystemAction summary call in ${filePath}`,
  );
}

// ─── P21: Sentry.captureException ────────────────────────────────────────────

const sentryTargets: [string, string][] = [
  ['src/lib/agents/strategy/plan-week.ts',                    'plan-week.ts'],
  ['src/app/api/render/story/[idea_id]/route.ts',             'render/story route'],
  ['src/app/api/cron/reconcile-renders/route.ts',             'reconcile-renders cron'],
  ['src/app/api/cron/reconcile-client-emails/route.ts',       'reconcile-client-emails cron'],
  ['src/app/api/cron/detect-stuck-plans/route.ts',            'detect-stuck-plans cron'],
];

for (const [filePath, label] of sentryTargets) {
  const content = readFile(filePath);
  check(
    `P21 — ${label} imports Sentry`,
    content.includes("from '@sentry/nextjs'"),
    `Expected: import * as Sentry from @sentry/nextjs in ${filePath}`,
  );
  check(
    `P21 — ${label} calls Sentry.captureException`,
    content.includes('Sentry.captureException('),
    `Expected: Sentry.captureException call in ${filePath}`,
  );
}

// ─── P12: inline story limit check in plan-week.ts ───────────────────────────

const planWeekP12 = readFile('src/lib/agents/strategy/plan-week.ts');

check(
  'P12 — plan-week.ts counts existing stories before planStoriesHandler',
  planWeekP12.includes('existingStoryCount') && planWeekP12.includes('storiesToGenerate'),
  'Expected: P12 inline count (existingStoryCount, storiesToGenerate) before planStoriesHandler call',
);

check(
  'P12 — plan-week.ts excludes client_rejected/replaced_by_variation',
  planWeekP12.includes('client_rejected,replaced_by_variation') || planWeekP12.includes("'client_rejected'"),
  'Expected: status exclusion filter for client_rejected and replaced_by_variation',
);

check(
  'P12 — plan-week.ts passes storiesToGenerate to planStoriesHandler',
  planWeekP12.includes('stories_per_week:          storiesToGenerate'),
  'Expected: planStoriesHandler called with storiesToGenerate not fixed quota',
);

// ─── P13: re-render on edit for stories ──────────────────────────────────────

const ideasRoute = readFile('src/app/api/client/weekly-plans/[id]/ideas/[ideaId]/route.ts');

check(
  'P13 — ideas route selects content_kind in prev snapshot',
  ideasRoute.includes('content_kind') && ideasRoute.includes("select('status, content_kind,"),
  'Expected: content_kind in the prev SELECT for story detection',
);

check(
  'P13 — ideas route marks pending_render on story edit',
  ideasRoute.includes("render_status: 'pending_render'") && ideasRoute.includes("action === 'edit'") && ideasRoute.includes("content_kind === 'story'"),
  'Expected: render_status=pending_render when action===edit and content_kind===story',
);

check(
  'P13 — ideas route resets render_attempts on story edit',
  ideasRoute.includes('render_attempts: 0'),
  'Expected: render_attempts reset to 0 on story edit (content changed, prior failures stale)',
);

// ─── P16: polling backoff + render_status ────────────────────────────────────

const planPage = readFile('src/app/(dashboard)/planificacion/[week_id]/page.tsx');

check(
  'P16 — render_status added to ContentIdea type',
  readFile('src/types/index.ts').includes("render_status?:"),
  'Expected: render_status optional field in ContentIdea interface',
);

check(
  'P16 — polling uses setTimeout (exponential backoff)',
  planPage.includes('setTimeout') && planPage.includes('pollDelayRef'),
  'Expected: setTimeout + pollDelayRef for backoff instead of fixed setInterval',
);

check(
  'P16 — polling includes pending_render and rendering states',
  planPage.includes("render_status === 'pending_render'") && planPage.includes("render_status === 'rendering'"),
  'Expected: render_status conditions in needsPolling predicate',
);

check(
  'P16 — backoff doubles up to 60s cap',
  planPage.includes('60_000') && planPage.includes('pollDelayRef.current * 2'),
  'Expected: backoff doubles each poll, capped at 60_000ms',
);

// ─── Results ─────────────────────────────────────────────────────────────────

const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;

console.log('\n=== verify-planning-fixes-fase4.ts ===\n');
for (const r of results) {
  const icon = r.passed ? '✅' : '❌';
  console.log(`${icon} ${r.name}`);
  if (!r.passed && r.detail) console.log(`   → ${r.detail}`);
}
console.log(`\n${passed}/${results.length} checks passed${failed > 0 ? ` (${failed} failed)` : ''}\n`);

process.exit(failed > 0 ? 1 : 0);
