-- =============================================================================
-- Migration: Multi-platform support — Facebook + TikTok
-- Run in Supabase SQL Editor
-- =============================================================================

-- ── TikTok columns in brands ─────────────────────────────────────────────────
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS tt_access_token   text,
  ADD COLUMN IF NOT EXISTS tt_refresh_token  text,
  ADD COLUMN IF NOT EXISTS tt_open_id        text,   -- TikTok user open_id
  ADD COLUMN IF NOT EXISTS tt_username       text,
  ADD COLUMN IF NOT EXISTS tt_token_expires_at timestamptz;

-- ── TikTok post ID in posts ───────────────────────────────────────────────────
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS tt_post_id text;

-- ── Facebook: columns already exist in brands (fb_page_id, fb_page_name, fb_access_token)
-- ── Facebook: fb_post_id already exists in posts

-- Verify
SELECT column_name FROM information_schema.columns
WHERE table_name = 'brands'
  AND column_name IN ('tt_access_token','tt_refresh_token','tt_open_id','tt_username','tt_token_expires_at','fb_page_id','fb_page_name','fb_access_token');

SELECT column_name FROM information_schema.columns
WHERE table_name = 'posts'
  AND column_name IN ('tt_post_id','fb_post_id');
