# Phase 0.A — `public.brands` schema audit

**Date:** 2026-04-24
**Scope:** consolidation of `supabase/schema.sql` against live production DB.
**Decision:** update `schema.sql` to match live, emit an idempotent migration documenting provenance.

## Method

1. `scripts/audit-brands-schema.ts` — probes the live DB, lists columns from a sample row, diffs against parsed `schema.sql`, checks existence of parallel tables. Writes `docs/phase0-schema-audit-raw.md`.
2. `scripts/audit-brands-types.ts` — infers SQL type per column from multiple sample rows + naming-suffix heuristics (`_at` → timestamptz, `_id` → text/uuid, etc.). Writes `docs/phase0-schema-audit-types.md`.
3. Cross-check with code (`prompts.ts`, `render.tsx`, `health-score.ts`) for semantic validation.

Both scripts run against `.env.local` Supabase service-role key. No schema change was executed by the scripts themselves.

## Findings at the start of Phase 0.A

### Drift: 46 columns live in DB but missing from `schema.sql`

```
ai_disclosure_committed_at, auto_approve_after_days, brief_completion_pct,
calendar_events_generated_at, churn_risk, churn_score, city, competitors,
compliance_flags, content_mix_preferences, dpa_accepted_at, fb_page_name,
first_content_at, human_review_config, ig_username, last_login_at,
last_no_content_email_at, last_no_social_email_at, last_onboarding_email_at,
last_plan_unused_email_at, last_post_published_at, last_reactivation_email_at,
logo_url, marketing_consent, marketing_consent_at, meta_token_expires_at,
notify_email_comments, notify_email_publish, onboarding_content_triggered,
plan_cancels_at, plan_started_at, posts_this_week, purchased_extra_accounts,
rejected_in_a_row, require_worker_review, secondary_sectors, stories_this_week,
subscribed_platforms, trial_ends_at, tt_access_token, tt_open_id,
tt_refresh_token, tt_token_expires_at, tt_username, use_new_planning_flow,
visual_style, week_reset_at
```

All of them were added by feature sprints without updating `schema.sql`.

Post-consolidation: 47 of them are now in `schema.sql` (the 46 above plus `week_reset_at` which had a default tied to `now()`). See raw audit for the final diff.

### Inverse drift: none

No column declared in `schema.sql` is missing from live DB.

### Bug: `brand.description` read in code but column does not exist

`src/lib/agents/stories/prompts.ts:52` reads `brand.description`. The column is absent from both `schema.sql` and the live DB. The read returns `undefined`, and the `if (desc) { ... }` guard silently drops that line from the prompt.

Not fixed in this phase — decision deferred (drop the read, or add the column in a later phase that actually populates it).

### Parallel tables

Direct existence probe (`SELECT ... LIMIT 0`):

| Table | Exists in live DB |
|---|---|
| `brands` | yes |
| `brand_material` | yes |
| `brand_kit` | **no** |
| `calendar_events` | yes |
| `seasonal_dates` | yes |
| `inspiration_bank` | yes |

Implications for the creative-direction plan:

- `brand_kit` is confirmed **not a separate table**. The UI "brand kit" is purely a view over `brands` + `brand_material`.
- `seasonal_dates` coexists with `calendar_events`. Two sources of truth for holidays, no coordinator.
- `inspiration_bank` is populated (Telegram ingest) but **not consumed** by `plan-week.ts` — it still queries `inspiration_references` only. Deuda técnica for Fase 3.

### Type confidence

Per-column inference based on 6 sample rows + suffix heuristics. High confidence for columns with non-null samples (62/73). Two columns had all-null samples in the probe — types chosen below are best-guess:

| Column | Inferred | Confidence | Reasoning |
|---|---|---|---|
| `logo_url` | `text` | high | suffix `_url` |
| `city` | `text` | high | companion to existing `location` |

For the exact DB types, run in Supabase SQL Editor and cross-check against the migration:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='brands'
ORDER BY ordinal_position;
```

See `docs/phase0-schema-audit-types.md` for the per-column inferred table.

## Actions taken in Phase 0.A

1. **`supabase/schema.sql`** — extended `CREATE TABLE public.brands` with the 47 missing columns, grouped logically (creative fields, ops flags, counters, social, lifecycle timestamps). Existing column declarations untouched; new ones appended after a comment block flagging the consolidation date.

2. **`supabase/migrations/20260424_brands_schema_consolidation.sql`** — idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for each. No-op in production. Re-creates the live schema from scratch in fresh environments. Adds `COMMENT ON COLUMN` for the columns most relevant to the creative-direction pipeline. Documents the `description` bug in a trailing comment.

3. **`scripts/verify-phase0-schema.ts`** — acceptance check that runs 8 validations: every `schema.sql` column exists live, no reverse drift, migration matches schema.sql 1:1 for post-initial columns, and the 5 parallel tables match expectations. All 8 pass.

## Verification

```
$ npx tsx --tsconfig tsconfig.json scripts/verify-phase0-schema.ts
✓ schema.sql columns all exist in live DB (71 declared)
✓ live DB columns all declared in schema.sql (71 live)
✓ migration 20260424 lists every post-initial column from schema.sql (47 expected, 47 in migration)
✓ parallel table `brand_material` exists
✓ parallel table `calendar_events` exists
✓ parallel table `seasonal_dates` exists
✓ parallel table `inspiration_bank` exists
✓ parallel table `brand_kit` does NOT exist
8/8 checks passed
```

## Open items (not blocking Phase 0.A)

- **`brand.description`**: silent bug, not fixed here. Fase 1 decision.
- **Exact DB types for the 2 all-null columns** (`logo_url`, `city`): run the authoritative SQL, confirm, patch the migration if any mismatch.
- **Unification of `seasonal_dates` vs `calendar_events`**: Fase 4 prerequisite.
- **`inspiration_bank` consumption**: Fase 3 prerequisite.
