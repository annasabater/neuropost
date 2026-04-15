-- =============================================================================
-- NEUROPOST — Weekly usage tracking + regeneration limits
-- Run this migration in Supabase SQL Editor
-- =============================================================================

-- ─── 1. Add missing columns to posts ─────────────────────────────────────────

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS week_start         date,
  ADD COLUMN IF NOT EXISTS photo_count        integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS regeneration_count integer NOT NULL DEFAULT 0;

-- Backfill week_start for existing posts (lunes de la semana de created_at)
UPDATE posts
SET week_start = date_trunc('week', created_at AT TIME ZONE 'UTC')::date
WHERE week_start IS NULL;

-- Index for weekly queries
CREATE INDEX IF NOT EXISTS idx_posts_brand_week
  ON posts (brand_id, week_start);

-- ─── 2. Create weekly_usage table ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS weekly_usage (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id           uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  week_start         date NOT NULL,
  photo_posts_used   integer NOT NULL DEFAULT 0,
  video_posts_used   integer NOT NULL DEFAULT 0,
  plan               text NOT NULL DEFAULT 'starter',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  UNIQUE (brand_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_usage_brand_week
  ON weekly_usage (brand_id, week_start);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_weekly_usage_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_weekly_usage_updated_at ON weekly_usage;
CREATE TRIGGER trg_weekly_usage_updated_at
  BEFORE UPDATE ON weekly_usage
  FOR EACH ROW EXECUTE FUNCTION update_weekly_usage_updated_at();

-- ─── 3. RLS policies for weekly_usage ────────────────────────────────────────

ALTER TABLE weekly_usage ENABLE ROW LEVEL SECURITY;

-- Clients can read their own usage
CREATE POLICY "weekly_usage: users read own brand"
  ON weekly_usage FOR SELECT
  USING (
    brand_id IN (
      SELECT id FROM brands WHERE user_id = auth.uid()
    )
  );

-- Service role can do everything (used by server-side logic)
CREATE POLICY "weekly_usage: service role full access"
  ON weekly_usage FOR ALL
  USING (auth.role() = 'service_role');

-- ─── 4. Cron: reset weekly counters every Monday at 00:00 UTC ────────────────
-- This uses pg_cron (available in Supabase).
-- It resets brands.posts_this_week and brands.videos_this_week for the weekly counter.
-- weekly_usage keeps the historical record — it is never deleted.

SELECT cron.schedule(
  'reset-weekly-counters',
  '0 0 * * 1',   -- Every Monday at 00:00 UTC
  $$
    UPDATE brands
    SET
      posts_this_week  = 0,
      videos_this_week = 0,
      stories_this_week = 0
    WHERE true;
  $$
);
