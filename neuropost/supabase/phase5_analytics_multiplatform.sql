-- ============================================================================
-- NeuroPost — Phase 5: per-platform analytics
--
-- Extends post_analytics so the same post can store metrics for each
-- platform it was published on. Before this migration the primary key was
-- post_id alone, forcing one row per post; after this migration it's
-- (post_id, platform), letting us keep native metrics per platform.
--
-- Also adds video / watch-time columns (Meta Reels + Facebook video) and
-- the platform-specific index the new analytics endpoints rely on.
--
-- Safe to re-run: every ALTER uses IF [NOT] EXISTS where supported.
-- The PK swap is wrapped in a DO block that first checks the current
-- constraint shape, so re-executing on an already-migrated DB is a no-op.
-- ============================================================================

BEGIN;

-- 1. Add platform column with default 'instagram' so existing rows stay valid.
ALTER TABLE public.post_analytics
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'instagram'
    CHECK (platform IN ('instagram', 'facebook', 'tiktok'));

-- 2. Add video / watch-time metrics that IG Reels + FB Videos + TikTok use.
ALTER TABLE public.post_analytics
  ADD COLUMN IF NOT EXISTS video_views         INT,
  ADD COLUMN IF NOT EXISTS avg_watch_time_sec  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS completion_rate     NUMERIC(5,2);

-- 3. Swap the primary key from (post_id) to (post_id, platform) so a
--    single post can carry one analytics row per platform.
DO $$
DECLARE
  existing_pk text;
BEGIN
  SELECT conname INTO existing_pk
  FROM pg_constraint
  WHERE conrelid = 'public.post_analytics'::regclass
    AND contype = 'p';

  IF existing_pk IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.post_analytics DROP CONSTRAINT %I', existing_pk);
  END IF;
END $$;

-- (Separate statement — adding a PK can only run when no conflicting
--  constraint exists, which we just guaranteed.)
ALTER TABLE public.post_analytics
  ADD PRIMARY KEY (post_id, platform);

-- 4. Index tuned for the new endpoints (GET /api/analytics/[platform]/[brandId]).
CREATE INDEX IF NOT EXISTS idx_post_analytics_brand_platform
  ON public.post_analytics (brand_id, platform, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_analytics_brand_platform_slot
  ON public.post_analytics (brand_id, platform, best_day, best_hour)
  WHERE best_hour IS NOT NULL;

COMMIT;

-- Sanity — how many rows per platform now.
DO $$
DECLARE
  n_ig int;
  n_fb int;
  n_tt int;
BEGIN
  SELECT count(*) INTO n_ig FROM public.post_analytics WHERE platform = 'instagram';
  SELECT count(*) INTO n_fb FROM public.post_analytics WHERE platform = 'facebook';
  SELECT count(*) INTO n_tt FROM public.post_analytics WHERE platform = 'tiktok';
  RAISE NOTICE 'post_analytics rows  IG=%  FB=%  TT=%', n_ig, n_fb, n_tt;
END $$;
