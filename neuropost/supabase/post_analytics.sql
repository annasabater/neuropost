-- =============================================================================
-- Post analytics — F5
-- =============================================================================
-- Rolling performance data per post, used by the analytics agent to recompute
-- content_categories.weight. Populated by:
--   • /api/cron/sync-comments (brings likes/comments from Meta Graph)
--   • Future sync job that reads /insights on every published post
--   • Manual inserts for historical data (seeding)
--
-- category_key is deliberately NULLABLE: posts created before the strategy
-- agent existed won't have one, and the recompute loop simply skips them.
-- Posts created via strategy:plan_week fan-out should have their
-- category_key written alongside the post row (future product work).

CREATE TABLE IF NOT EXISTS public.post_analytics (
  post_id         UUID PRIMARY KEY REFERENCES public.posts(id) ON DELETE CASCADE,
  brand_id        UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,

  impressions     INT DEFAULT 0,
  reach           INT DEFAULT 0,
  likes           INT DEFAULT 0,
  comments        INT DEFAULT 0,
  saves           INT DEFAULT 0,
  shares          INT DEFAULT 0,

  engagement_rate NUMERIC,        -- (likes+comments+saves+shares) / reach
  best_hour       INT,            -- 0-23, when the post got most engagement
  best_day        INT,            -- 0-6 (Mon=0), published day-of-week

  category_key    TEXT,           -- strategy taxonomy key (null = unknown)
  format          TEXT,           -- 'foto' | 'carrusel' | 'reel' | 'video' | 'story'

  fetched_at      TIMESTAMPTZ DEFAULT NOW(),
  published_at    TIMESTAMPTZ     -- denormalized for time-window queries
);

CREATE INDEX IF NOT EXISTS idx_post_analytics_brand
  ON public.post_analytics(brand_id, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_analytics_category
  ON public.post_analytics(brand_id, category_key)
  WHERE category_key IS NOT NULL;

ALTER TABLE public.post_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_analytics: brand owner read"
  ON public.post_analytics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = post_analytics.brand_id
        AND brands.user_id = auth.uid()
    )
  );

CREATE POLICY "post_analytics: worker read"
  ON public.post_analytics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workers
      WHERE workers.id = auth.uid()
        AND workers.is_active = true
    )
  );

-- =============================================================================
-- Helper: store category_key on the posts table for strategy-driven posts
-- =============================================================================
-- Adds a lightweight metadata column so sub-jobs created by strategy:plan_week
-- can stamp the category_key onto the resulting post. Safe to run on existing
-- databases (ADD COLUMN IF NOT EXISTS is no-op if already present).

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS strategy_category_key TEXT;

CREATE INDEX IF NOT EXISTS idx_posts_strategy_category
  ON public.posts(brand_id, strategy_category_key)
  WHERE strategy_category_key IS NOT NULL;
