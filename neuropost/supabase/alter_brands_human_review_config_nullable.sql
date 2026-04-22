-- ═══════════════════════════════════════════════════════════════════════════
-- Allow brands.human_review_config to be NULL
-- ═══════════════════════════════════════════════════════════════════════════
-- Commit 056bed7 introduced the "diff-only" override model: a brand stores
-- only the flags that differ from the global defaults in app_settings. When
-- every flag matches the defaults, human_review_config should be NULL to
-- represent "fully inherited". The existing NOT NULL constraint breaks that
-- semantics and surfaces as a 23502 failure on UPDATE/DELETE endpoints.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.brands
  ALTER COLUMN human_review_config DROP NOT NULL;
