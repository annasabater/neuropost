-- ═══════════════════════════════════════════════════════════════════════════════
-- Video support + subscribed platforms migration
-- 2026-04-17
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Posts: video support fields ──────────────────────────────────────────────
ALTER TABLE posts ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'none';
  -- 'photos' | 'video' | 'none' — what the client uploaded

ALTER TABLE posts ADD COLUMN IF NOT EXISTS video_url text;
  -- URL of generated/uploaded video (for video/reel format posts)

ALTER TABLE posts ADD COLUMN IF NOT EXISTS video_duration integer;
  -- Desired video duration in seconds (only for format=video/reel)

-- ── Brands: subscribed platforms ─────────────────────────────────────────────
ALTER TABLE brands ADD COLUMN IF NOT EXISTS subscribed_platforms text[]
  DEFAULT ARRAY['instagram'];
  -- Platforms the client is paying for. Defaults to Instagram only.
  -- Extra platforms = +€15/mo each via Stripe add-on.

-- ── Index for filtering posts by format ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_posts_format ON posts(format);
