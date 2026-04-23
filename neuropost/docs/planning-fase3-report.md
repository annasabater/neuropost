# Planning Fase 3 — Final Report

## Status of the 22 original problems

| # | Status | Phase | Commit(s) |
|---|---|---|---|
| P1 | ✅ Closed | Fase 1 | — |
| P2 | ✅ Closed | Fase 1 | — |
| P3 | ✅ Closed | Fase 1 | — |
| P4 | ✅ Closed | Fase 1 | — |
| P5 | ✅ Closed | Fase 1 | — |
| P6 | ✅ Closed | Fase 3.2 | c11cbdd + ad21625 |
| P7 | ✅ Closed | Fase 3.1 | b0247da (same fix as P20) |
| P8 | ✅ Closed | Fase 1 | — |
| P9 | ✅ Closed | Fase 3.3 | [commit 3.3] |
| P10 | ✅ Closed | Fase 3.3 | [commit 3.3] |
| P11 | ⏳ Pending | Fase 4 | — |
| P12 | ⏳ Pending | Fase 4 | — |
| P13 | ⏳ Pending | Fase 4 | — |
| P14 | ⏳ Pending | Fase 4 | — |
| P15 | ✅ Closed | Fase 1 | — |
| P16 | ⏳ Pending | Fase 4 | — |
| P17 | ⏳ Pending | Fase 4 | — |
| P18 | ⏳ Pending | Fase 4 | — |
| P19 | ⏳ Pending | Fase 4 | — |
| P20 | ✅ Closed | Fase 3.1 | b0247da |
| P21 | ⏳ Pending | Fase 4 | — |
| P22 | ✅ Closed | Fase 1 | — |

**Fase 3 closes 4 new problems:** P6, P7 (via P20 fix), P9, P10.
**Total closed after Fase 3:** 12 of 22.

---

## Migrations applied in Fase 3

| File | Contents |
|---|---|
| `20260423_planning_fixes_fase3_atomic_create_plan.sql` | UNIQUE INDEX `uq_weekly_plans_brand_week` on `weekly_plans(brand_id, week_start)` + `create_weekly_plan_atomic` RPC (SECURITY DEFINER, service_role only) |
| `20260423_planning_fixes_fase3_p6_hotfix.sql` | `CREATE OR REPLACE FUNCTION` replacing the above — adds `(idea->>'day_of_week')::int` cast missing from the original |
| `20260423_planning_fixes_fase3_template_fk.sql` | Defensive `UPDATE` to clear orphan `template_id`s (0 found) + `FK fk_content_ideas_template_id REFERENCES story_templates(id) ON DELETE SET NULL` |

---

## Code changes in Fase 3

| File | Change |
|---|---|
| `src/lib/planning/weekly-plan-service.ts` | `ConcurrentPlanModificationError` class; `transitionWeeklyPlanStatus` atomic via `WHERE status=$old + maybeSingle()`; `createWeeklyPlanFromOutput` now calls `db.rpc('create_weekly_plan_atomic')` |
| `src/lib/agents/strategy/plan-week.ts` | `ConcurrentPlanModificationError` catch; P10 guard after `templatesEnabled` resolution — returns `{ type: 'fail', error: 'NO_STORY_TEMPLATES…' }` immediately if no templates found |
| `src/app/api/worker/weekly-plans/[id]/approve/route.ts` | catch `ConcurrentPlanModificationError` → HTTP 409 |
| `src/app/api/worker/weekly-plans/[id]/reject/route.ts` | same pattern |
| `src/app/api/client/weekly-plans/[id]/confirm/route.ts` | same pattern |
| `src/app/api/client/weekly-plans/[id]/skip-week/route.ts` | same pattern |
| `src/lib/planning/proposal-hooks.ts` | catch `ConcurrentPlanModificationError` → log + return (background hook) |

---

## Tests

| Phase | Script | Checks | Status (after migrations) |
|---|---|---|---|
| Fase 1 | `verify-planning-fixes-fase1.ts` | 13 | 13/13 ✅ |
| Fase 2 | `verify-planning-fixes-fase2.ts` | 8 | 8/8 ✅ |
| Fase 3 | `verify-planning-fixes-fase3.ts` | 11 | 11/11 ✅ |
| **Total** | | **32** | **32/32** |

Run: `npx tsx --tsconfig tsconfig.json scripts/verify-planning-fixes-fase3.ts`

---

## Pre-migration findings (investigation, 2026-04-23)

- **Duplicate `(brand_id, week_start)`**: 0 found — UNIQUE INDEX safe to add immediately.
- **Orphan `template_id`**: 0 found — FK migration safe; defensive UPDATE is a no-op.
- **System templates**: 10 found (`kind='system'`); 0 custom templates.
- **Brands with `use_new_planning_flow=true`**: 1 (SportArea, `e8dc77ef-…`).

---

## Serialization bug found during P6 verify (Fase 3.2 hotfix)

Two bugs were uncovered when the migration was applied and the verify script ran:

1. **Client (`weekly-plan-service.ts`)**: `p_ideas` was passed as `JSON.stringify(array)`. Supabase-js received a string scalar instead of a JSONB array → Postgres error "cannot get array length of a scalar". Fix: pass `parsedIdeas` directly.

2. **RPC**: `day_of_week` extracted with `->>` (returns `text`) but `content_ideas.day_of_week` is `integer`. The implicit cast Postgres normally applies does not apply inside `SELECT … FROM jsonb_array_elements`. Fix: `(idea->>'day_of_week')::int`.

Production was never affected because `parse-ideas.ts` always sets `day_of_week: null` — `NULL::int` is fine.

---

## Guard placement decision (P10)

All three plans in `PLAN_CONTENT_QUOTAS` define `stories_per_week ≥ 3`. There is no zero-stories plan. The guard is placed **immediately after `templatesEnabled` is resolved** (before `planStoriesHandler` is called), unconditionally. No `if (storiesPerWeek > 0)` wrapper is needed.

---

## Out of scope / detected but deferred

- `calendar_ready → completed` transition: no code path currently transitions plans to `completed`. Documented as a product feature gap (not a bug). Pending Fase 4.
- `logAudit()` not called anywhere in the planning pipeline (P14) — pending Fase 4.
- `image_generation_prompt` as a column vs. `REPLICATE:` prefix in hook (P17) — pending Fase 4.

---

## Rollback plan for Fase 3

All Fase 3 changes are structural (indexes, constraints, functions) + additive code. No data is deleted. Rollback steps in reverse order:

```sql
-- 1. Drop FK
ALTER TABLE content_ideas DROP CONSTRAINT IF EXISTS fk_content_ideas_template_id;

-- 2. Drop RPC
DROP FUNCTION IF EXISTS public.create_weekly_plan_atomic(uuid, date, uuid, uuid, jsonb);

-- 3. Drop UNIQUE INDEX
DROP INDEX IF EXISTS public.uq_weekly_plans_brand_week;
```

```bash
# Revert code commits
git revert ad21625 c11cbdd b0247da --no-commit
git commit -m "revert: Fase 3 rollback"
```

---

## Next steps — Fase 4

10 problems pending: P11 (fallback marker), P12 (`checkStoryLimit`), P13 (re-render on edit), P14 (audit logging), P16 (polling backoff), P17 (`image_generation_prompt` column), P18 (confirm atomic), P19 (schedule parsing guard), P21 (Sentry integration).
