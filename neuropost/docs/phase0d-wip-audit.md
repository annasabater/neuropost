# Phase 0.D — WIP audit report

**Date:** 2026-04-24
**Scope:** catalog of working-tree WIP and pending stashes before starting Phase 1.
**Action applied:** none. This doc is read-only; the user decides per item in a follow-up session.

## Initial state

```
git status:
 M neuropost/package.json
 M neuropost/src/app/(dashboard)/brand/material/_components/display/contentToDisplay.ts
 M neuropost/src/app/(dashboard)/brand/page.tsx
 M package-lock.json
?? neuropost/scripts/link-workspace-deps.sh

git stash list:
stash@{0}  WIP on main: faedfe2 Sprint 12: Inspiración v3 — separación guardar/solicitar
stash@{1}  WIP on main: 6662fc5 fix(recreations): atomise regeneration slot reserve/release
stash@{2}  On main: wip: next downgrade attempt
```

## 1.A — `next.config.js`

**No diff against HEAD.** The original WIP (which removed `async` from `redirects()` / `headers()`) was resolved during the Phase 0 build debugging in previous sessions via repeated `cp` / `mv` cycles that landed the file back on HEAD contents. Benign debugging artefact, not data loss. Nothing to audit here.

**Recommendation:** none needed.

## 1.B — `neuropost/package.json`

Diff (live):

```diff
   "scripts": {
+    "postinstall": "bash scripts/link-workspace-deps.sh",
     "dev": "next dev",
...
-    "@supabase/ssr": "^0.10.0",
-    "@supabase/supabase-js": "^2.101.1",
+    "@supabase/ssr": "^0.10.2",
+    "@supabase/supabase-js": "^2.104.1",
```

Three changes:

1. New `postinstall` hook that runs the (untracked) workspace-link script — pairs with 1.E.
2. `@supabase/ssr` patch bump 0.10.0 → 0.10.2.
3. `@supabase/supabase-js` patch bump 2.101.1 → 2.104.1.

Both supabase packages are minor/patch bumps, no API breaks expected. Paired with a 22,739-line `package-lock.json` diff (11,514 insertions / 11,225 deletions) that corresponds to re-resolution after these bumps (plus possibly other transitive drift from the monorepo root install).

**Recommendation:** **COMMIT (paired with 1.E and `package-lock.json`).** Internally coherent: bumps + postinstall + target script + refreshed lockfile form one unit. Worth confirming with the user that (a) the supabase bumps have been exercised locally, and (b) the `postinstall` hook has run at least once successfully.

**Question to user:** is the `postinstall: bash scripts/link-workspace-deps.sh` hook battle-tested (run on fresh clone, CI, Vercel build), or only locally? If only locally, it may silently break deploy.

## 1.C — `contentToDisplay.ts`

Diff (summary): adds a new branch at the top of the `'schedule'` category to handle `schema_version === 2` brand_material content. The new branch reads `content.schedules[]` with labels and `days[]`, formats day-initials in Spanish (`L/M/X/J/V/S/D`) plus hours. The existing v1 branch (`content.days[]`) is kept intact as fallback.

```diff
   if (cat === 'schedule') {
+    // v2 format: content.schedules[].days
+    if (content.schema_version === 2 && Array.isArray(content.schedules)) {
+      ...
+    }
+    // v1 format: content.days
     const days = (content.days as DayHour[] | undefined) ?? [];
```

Matches the v2 schema introduced in `supabase/migrations/20260430_sprint12_brand_material_v2.sql`.

**Recommendation:** **COMMIT.** Non-breaking: v1 fallback preserved, only extends support when `schema_version === 2` is present. Aligned with an existing migration that is already on HEAD. Isolated change (one file, one function).

## 1.D — `brand/page.tsx`

Diff (live): adds a single trailing newline at EOF. Zero semantic change.

```diff
 export default function BrandPage() {
   redirect('/brand-kit');
 }
+
```

**Recommendation:** **COMMIT or REVERT — irrelevant.** Likely an editor auto-save artefact. Safe to include or discard; include alongside 1.C if convenient.

## 1.E — `scripts/link-workspace-deps.sh` (untracked)

Contents:

```bash
#!/usr/bin/env bash
# Symlinks scoped packages from monorepo root into neuropost/node_modules
# so Turbopack can find them without traversing parent directories.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)/node_modules"
NP="$(cd "$(dirname "$0")/.." && pwd)/node_modules"

SCOPES="@supabase @opentelemetry @sentry @anthropic-ai @dnd-kit @fal-ai @ffmpeg-installer @parcel @react-email @stripe @tailwindcss"

for scope in $SCOPES; do
  mkdir -p "$NP/$scope"
  for pkg in $(ls "$ROOT/$scope/" 2>/dev/null); do
    ln -sf "$ROOT/$scope/$pkg" "$NP/$scope/$pkg" 2>/dev/null || true
  done
done

echo "[link-workspace-deps] Done."
```

Purpose: after a monorepo-root `npm install` resolves all workspace deps into the **root** `node_modules/@scope/`, Turbopack (running in `neuropost/`) cannot traverse up to find them. This script creates symlinks inside `neuropost/node_modules/@scope/pkg → ../../../node_modules/@scope/pkg`, so Turbopack resolves packages without `findPackageRoot` issues. Referenced by the `postinstall` hook in 1.B — they are a pair.

**Recommendation:** **COMMIT (paired with 1.B).** Makes sense, is idempotent (`ln -sf`), swallows errors (`|| true`) so a missing scope doesn't fail install. One observation: the scope list is hardcoded — future new scopes will require an edit. Not a blocker but worth a comment.

**Question to user:** any reason this was not committed earlier? If the postinstall hook was added to silence a specific Turbopack bug, a comment in the script pointing at the symptom would help future maintainers.

## 1.F — `package-lock.json` (monorepo root)

22,739 lines changed (11,514 insertions / 11,225 deletions), one file. Consistent with transitive re-resolution driven by 1.B's supabase bumps. Not inspected line-by-line (too large).

**Recommendation:** **COMMIT paired with 1.B.** Lockfile drift disconnected from `package.json` is worse than the churn of a lockfile re-sync.

---

## Stashes

### stash@{0} — Sprint 12: Inspiración v3 — separación guardar/solicitar

Stat:

```
 neuropost/package.json                             |   7 +-
 neuropost/scripts/test_sprint11.ts                 |   3 +
 neuropost/src/app/(dashboard)/inspiracion/page.tsx |  64 ++--
 neuropost/src/app/(dashboard)/planificacion/[week_id]/page.tsx   | 124 ++-
 neuropost/src/app/globals.css                      | 104 ++-
 neuropost/src/components/ui/FeedbackWidget.tsx     |  11 +-
 neuropost/src/lib/agents/stories/plan-stories.ts   |   5 +-
 neuropost/src/lib/agents/strategy/plan-week.ts     |  17 +-
 neuropost/src/proxy.ts                             |   1 +
 neuropost/src/types/index.ts                       |   2 +
 neuropost/tsconfig.json                            |  27 +-
 package-lock.json                                  |  95 ++-
 package.json                                       |   1 +
 13 files changed, 350 insertions(+), 111 deletions(-)
```

Content preview:

- Adds `test:sprint12` script + bumps `next 16.2.2 → ^16.2.4` and pins `typescript ^5.9.3 → 5.9.3`.
- Touches `plan-stories.ts` and `plan-week.ts`, which have received substantial changes in later phases (planning-fixes Fase 3 / Fase 4, and now Phase 0.C renamed `render.tsx` but not these two).
- Touches `proxy.ts`, `inspiracion/page.tsx`, `planificacion/[week_id]/page.tsx`, `FeedbackWidget`, `globals.css`, `tsconfig.json`.

**Recommendation:** **REVIEW WITH USER.** High likelihood of merge conflict against current HEAD because `plan-stories.ts` and `plan-week.ts` have evolved. Parts of this stash may already be in HEAD (the `next` bump to 16.2.4 is already there). The inspiración-v3 UI changes may still be relevant for Fase 1/Fase 3 work.

**Question to user:** is Sprint 12 Inspiración v3 "separar guardar/solicitar" a feature that was later delivered (merged differently) or abandoned? If delivered → drop. If still pending → checkpoint to a branch before dropping, so the work survives.

### stash@{1} — fix(recreations): atomise regeneration slot reserve/release

Stat:

```
 backend/agents/analyst/prompts.ts            |  28 +-
 backend/agents/community/prompts.ts          |   7 +
 backend/agents/copywriter/prompts.ts         |  12 +-
 backend/agents/planner/prompts.ts            |  27 +-
 backend/agents/publisher/prompts.ts          |  11 +
 backend/agents/shared/types.ts               |   7 +
 neuropost/src/app/(auth)/onboarding/page.tsx | 244 ++++++++++++++++++++
 neuropost/src/app/page.tsx                   |   6 +-
 neuropost/src/app/que-incluye/page.tsx       |  22 +-
 neuropost/src/lib/agentContext.ts            |   4 +-
 neuropost/src/lib/agents/helpers.ts          |  31 +-
 neuropost/src/types/index.ts                 |   7 +
 12 files changed, 316 insertions(+), 90 deletions(-)
```

Content preview (analyst):

- Adds `SECTOR_ALIAS` map (Spanish UI keys → English benchmark keys: `restaurante → restaurant`, `boutique → retail`, etc.) and `normalizeSector()` helper.
- Updates `buildAnalystSystemPrompt` to apply `normalizeSector` before looking up benchmarks.
- Similar brand-voice/sector handling updates across 5 backend agents + `agents/helpers.ts` + `types/index.ts` (adds 7 lines).
- 244 lines added to onboarding page — looks substantial UX work.

**Note:** the stash **name** ("atomise regeneration slot reserve/release") does NOT match the **content** (sector normalisation + onboarding changes). Likely the stash was created on top of earlier uncommitted work and picked up an unrelated message. This happens when you `git stash push` without message.

**Recommendation:** **REVIEW WITH USER — probably apply to a branch.** The content looks like real feature work (sector normalisation is a known bug-fix pattern; the onboarding changes may be the same set of screens shown in the earlier screenshots). Dropping this stash without inspection risks losing valuable work. Safe plan: `git stash branch wip/sector-onboarding stash@{1}` to move it to a branch, then decide.

**Question to user:** do you recognise this sector-normalisation + onboarding work as delivered, abandoned, or still pending?

### stash@{2} — On main: wip: next downgrade attempt

Stat:

```
 neuropost/next.config.mjs |   53 --
 neuropost/package.json    |    5 +-
 neuropost/src/proxy.ts    |  128 ---
 package-lock.json         | 2225 ++++++++++++++++++++++++++++++++++++++++------
 package.json              |   10 +-
 5 files changed, 1547 insertions(+), 874 deletions(-)
```

Content preview:

- **Deletes** `neuropost/next.config.mjs` (53 lines). (On HEAD the config is `next.config.js`, not `.mjs` — indicates the stash was created at a point where config was still `.mjs`.)
- **Deletes** `neuropost/src/proxy.ts` (128 lines). Current HEAD has `src/proxy.ts`.
- Downgrade `next: 16.2.2 → 15.5.15` (MAJOR backwards).
- Adds `zod ^3.25.76` as explicit dep (no longer implicit via next).
- 2,225-line lockfile rewrite.

**Recommendation:** **DROP.** This is an abandoned downgrade attempt from a time when the config file was `.mjs` and the proxy path differed. Applying it would:

1. Delete `next.config.js` (via rename confusion).
2. Delete `src/proxy.ts` entirely.
3. Roll Next back from 16.2.4 → 15.5.15 (loss of all Next 16 features).

Currently we have Next 16.2.4 working (build verde). This stash has no value and substantial destructive risk. Safe to `git stash drop stash@{2}` after user confirmation.

**Question to user:** confirm this stash is truly abandoned (the attempt did not lead to any committed work) before dropping.

---

## Summary recommendations

| Item | Recommendation | Blocker / Note |
|---|---|---|
| 1.A `next.config.js` | No action | Already clean |
| 1.B `package.json` | Commit (paired with 1.E + 1.F) | Confirm postinstall is CI-safe |
| 1.C `contentToDisplay.ts` | Commit | Aligned with existing migration |
| 1.D `brand/page.tsx` | Commit or revert (irrelevant) | Whitespace only |
| 1.E `link-workspace-deps.sh` | Commit (paired with 1.B) | Add a comment explaining why |
| 1.F `package-lock.json` | Commit (paired with 1.B) | Don't commit lockfile alone |
| stash@{0} Inspiración v3 | Review — likely `stash branch` then evaluate | Touches files evolved since |
| stash@{1} Sector + onboarding | Review — likely `stash branch` then evaluate | Valuable work, wrong stash name |
| stash@{2} Next downgrade | Drop (after user confirms) | Destructive, no value |

**Critical questions for the user:**

1. Has the `postinstall: bash scripts/link-workspace-deps.sh` hook been tested on CI / Vercel deploy, or only on local `npm install`?
2. Is "Sprint 12 Inspiración v3" (stash@{0}) a feature that was delivered differently later, or still pending?
3. Is the sector-normalisation + onboarding work in stash@{1} familiar — delivered, abandoned, or pending?
4. Confirm stash@{2} (Next 15.5.15 downgrade) is abandoned and safe to drop.
