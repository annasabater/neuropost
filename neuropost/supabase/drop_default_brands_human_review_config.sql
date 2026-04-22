-- ═══════════════════════════════════════════════════════════════════════════
-- Drop the column default on brands.human_review_config
-- ═══════════════════════════════════════════════════════════════════════════
-- With the diff-override model, a brand with NULL human_review_config
-- inherits every flag from app_settings.human_review_defaults. New brands
-- should start out inheriting — so the column must default to NULL rather
-- than to a snapshot of flag values. Without this, new signups would be
-- created with an explicit override and show up under "clientes con
-- override" in /worker/settings?tab=revision from day one.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.brands
  ALTER COLUMN human_review_config DROP DEFAULT;
