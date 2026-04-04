-- =============================================================================
-- NEUROPOST — Migration: Visual Style, Secondary Sectors, Stories, Weekly Counters
-- Run this in your Supabase SQL editor
-- =============================================================================

-- ── 1. brands: visual_style ───────────────────────────────────────────────────
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS visual_style text DEFAULT 'warm'
  CHECK (visual_style IN ('creative', 'elegant', 'warm', 'dynamic'));

-- ── 2. brands: secondary_sectors (array, max 2) ───────────────────────────────
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS secondary_sectors text[] DEFAULT '{}';

-- ── 3. brands: weekly counters (reset every Monday by cron) ──────────────────
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS posts_this_week   int          DEFAULT 0;
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS stories_this_week int          DEFAULT 0;
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS week_reset_at     timestamptz  DEFAULT now();

-- ── 4. posts: story support ───────────────────────────────────────────────────
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS is_story   boolean DEFAULT false;
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS story_type text    DEFAULT null
  CHECK (story_type IS NULL OR story_type IN ('repost', 'new', 'auto'));

-- ── 5. Update plan type check (if you have a check constraint) ────────────────
-- If your brands.plan column has a CHECK constraint, update it:
-- ALTER TABLE brands DROP CONSTRAINT IF EXISTS brands_plan_check;
-- ALTER TABLE brands ADD CONSTRAINT brands_plan_check
--   CHECK (plan IN ('starter', 'pro', 'total', 'agency'));

-- ── 6. Index for story queries ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS posts_is_story_brand_idx
  ON posts (brand_id, is_story)
  WHERE is_story = true;

-- ── 7. Function: reset weekly counters (called by cron every Monday 00:00) ───
CREATE OR REPLACE FUNCTION reset_weekly_post_counters()
RETURNS void AS $$
BEGIN
  UPDATE brands
  SET
    posts_this_week   = 0,
    stories_this_week = 0,
    week_reset_at     = now();
END;
$$ LANGUAGE plpgsql;
