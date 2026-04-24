-- =============================================================================
-- 20260424_brands_schema_consolidation.sql
-- =============================================================================
-- Phase 0.A — consolidate `public.brands` schema after accumulated drift.
--
-- CONTEXT
-- Live production DB has 46 columns on `public.brands` that do NOT appear
-- in `supabase/schema.sql` as of 2026-04-24. They were added ad-hoc by
-- feature sprints without updating the canonical schema file. See
-- `docs/phase0-schema-audit.md` for the full audit trail.
--
-- This migration is IDEMPOTENT:
--   - All ADD COLUMN statements use `IF NOT EXISTS`, so they are no-ops
--     against production where the columns already exist.
--   - Its real purpose is to (a) document provenance for future devs and
--     (b) make the schema reproducible from scratch (e.g. local dev,
--     tests, new staging environments).
--
-- TYPE CONFIDENCE
-- Most types below are inferred from live sample rows. Three columns had
-- all-null samples so the type is a best guess:
--   - `logo_url`   → text (suffix `_url`)
--   - `city`       → text (companion to existing `location`)
-- If you discover a mismatch with the actual DB type, file a follow-up.
--
-- SCOPE
-- Zero functional change. No data migration. No index or RLS change.
-- =============================================================================

BEGIN;

ALTER TABLE public.brands
  -- Creative direction fields (used by prompts.ts / render.tsx)
  ADD COLUMN IF NOT EXISTS visual_style                   text,
  ADD COLUMN IF NOT EXISTS logo_url                       text,
  ADD COLUMN IF NOT EXISTS city                           text,
  ADD COLUMN IF NOT EXISTS secondary_sectors              text[]    DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS subscribed_platforms           text[]    DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS competitors                    text[]    DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS compliance_flags               jsonb,
  ADD COLUMN IF NOT EXISTS content_mix_preferences        jsonb,
  ADD COLUMN IF NOT EXISTS human_review_config            jsonb,

  -- Operational flags
  ADD COLUMN IF NOT EXISTS require_worker_review          boolean   DEFAULT true,
  ADD COLUMN IF NOT EXISTS use_new_planning_flow          boolean   DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_content_triggered   boolean   DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_consent              boolean   DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_email_comments          boolean   DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_email_publish           boolean   DEFAULT true,

  -- Weekly counters / scoring
  ADD COLUMN IF NOT EXISTS posts_this_week                integer   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stories_this_week              integer   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS brief_completion_pct           integer   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS churn_score                    integer   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS churn_risk                     text      DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS rejected_in_a_row              integer   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_approve_after_days        integer   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchased_extra_accounts       integer   DEFAULT 0,

  -- Social identities
  ADD COLUMN IF NOT EXISTS ig_username                    text,
  ADD COLUMN IF NOT EXISTS fb_page_name                   text,
  ADD COLUMN IF NOT EXISTS tt_username                    text,
  ADD COLUMN IF NOT EXISTS tt_open_id                     text,
  ADD COLUMN IF NOT EXISTS tt_access_token                text,
  ADD COLUMN IF NOT EXISTS tt_refresh_token               text,
  ADD COLUMN IF NOT EXISTS tt_token_expires_at            timestamptz,
  ADD COLUMN IF NOT EXISTS meta_token_expires_at          timestamptz,

  -- Lifecycle timestamps
  ADD COLUMN IF NOT EXISTS first_content_at               timestamptz,
  ADD COLUMN IF NOT EXISTS last_post_published_at         timestamptz,
  ADD COLUMN IF NOT EXISTS last_login_at                  timestamptz,
  ADD COLUMN IF NOT EXISTS last_onboarding_email_at       timestamptz,
  ADD COLUMN IF NOT EXISTS last_no_content_email_at       timestamptz,
  ADD COLUMN IF NOT EXISTS last_no_social_email_at        timestamptz,
  ADD COLUMN IF NOT EXISTS last_plan_unused_email_at      timestamptz,
  ADD COLUMN IF NOT EXISTS last_reactivation_email_at     timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_consent_at           timestamptz,
  ADD COLUMN IF NOT EXISTS dpa_accepted_at                timestamptz,
  ADD COLUMN IF NOT EXISTS ai_disclosure_committed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS plan_started_at                timestamptz,
  ADD COLUMN IF NOT EXISTS plan_cancels_at                timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at                  timestamptz,
  ADD COLUMN IF NOT EXISTS week_reset_at                  timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS calendar_events_generated_at   timestamptz;

-- Documentation for future developers (shows up in psql \d+).
-- Focused on the columns used by the creative-direction pipeline today.
COMMENT ON COLUMN public.brands.visual_style IS
  'Visual style id. Mapped by VISUAL_STYLE_LABELS in src/lib/agents/stories/prompts.ts.';
COMMENT ON COLUMN public.brands.logo_url IS
  'Brand logo URL. Read by src/lib/stories/render.tsx (LayoutCentered).';
COMMENT ON COLUMN public.brands.city IS
  'Finer-grained location than `location`. Used by SeasonalAgent / detect-holidays.';
COMMENT ON COLUMN public.brands.calendar_events_generated_at IS
  'Last time detect-holidays cron regenerated calendar_events for this brand. NULL means never.';
COMMENT ON COLUMN public.brands.content_mix_preferences IS
  'JSONB. Per-brand preferences over story_type mix. Used by plan-week / plan-stories.';
COMMENT ON COLUMN public.brands.human_review_config IS
  'JSONB. Per-brand override of worker-review routing rules.';

COMMIT;

-- NOTE: `brand.description` is read by prompts.ts:52 but the column does NOT
-- exist in the live database. It is always undefined in practice, so the
-- conditional in the prompt silently skips that line. Not added by this
-- migration — left to a future phase that decides whether to drop the read
-- from code or actually add the column.
