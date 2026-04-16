-- =============================================================================
-- Premium features migration — run in Supabase SQL Editor
-- =============================================================================

-- ─── A/B Testing captions ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ab_tests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  post_id         uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  status          text DEFAULT 'running',  -- running, completed, cancelled
  -- Variant A (original)
  caption_a       text NOT NULL,
  hashtags_a      text[] DEFAULT '{}',
  -- Variant B (alternative)
  caption_b       text NOT NULL,
  hashtags_b      text[] DEFAULT '{}',
  -- Results
  impressions_a   int DEFAULT 0,
  impressions_b   int DEFAULT 0,
  engagement_a    numeric(5,2) DEFAULT 0,
  engagement_b    numeric(5,2) DEFAULT 0,
  winner          text,  -- 'a' | 'b' | null (undecided)
  -- Timing
  started_at      timestamptz DEFAULT now(),
  completed_at    timestamptz,
  -- The winning caption is applied to the post automatically
  auto_apply      boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ab_tests_post ON ab_tests(post_id);
CREATE INDEX IF NOT EXISTS idx_ab_tests_brand ON ab_tests(brand_id, status);

-- ─── Seasonal dates (brand-specific) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS seasonal_dates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        uuid REFERENCES brands(id) ON DELETE CASCADE,  -- null = global
  name            text NOT NULL,
  date            date NOT NULL,
  category        text DEFAULT 'holiday',  -- holiday, event, promotion, custom
  relevance       text DEFAULT 'medium',   -- high, medium, low
  sector          text,                     -- null = all sectors
  country         text DEFAULT 'ES',
  days_advance    int DEFAULT 3,            -- days before to start generating
  active          boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seasonal_dates_upcoming
  ON seasonal_dates(date, active) WHERE active = true;

-- ─── Health metrics log ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS health_metrics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at      timestamptz DEFAULT now(),
  -- Per-service response times (ms), null = not checked
  supabase_ms     int,
  redis_ms        int,
  anthropic_ms    int,
  replicate_ms    int,
  stripe_ms       int,
  meta_api_ms     int,
  -- Queue depth
  queue_pending   int,
  queue_running   int,
  queue_errored   int,
  -- Overall
  all_healthy     boolean DEFAULT true,
  details         jsonb
);

-- Auto-delete metrics older than 30 days
CREATE INDEX IF NOT EXISTS idx_health_metrics_time ON health_metrics(checked_at DESC);

-- ─── TikTok fields on posts ─────────────────────────────────────────────────

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS tiktok_video_id text,
  ADD COLUMN IF NOT EXISTS tiktok_publish_id text;
