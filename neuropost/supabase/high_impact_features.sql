-- =============================================================================
-- High-impact features migration — run in Supabase SQL Editor
-- =============================================================================

-- ─── 1. Notification preferences ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_preferences (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id   uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  -- Per-type toggles: app (always on), email, digest
  post_ready_email     boolean DEFAULT true,
  post_published_email boolean DEFAULT true,
  comment_email        boolean DEFAULT false,
  ticket_reply_email   boolean DEFAULT true,
  weekly_report_email  boolean DEFAULT true,
  plan_alert_email     boolean DEFAULT true,
  marketing_email      boolean DEFAULT false,
  -- Digest: batch non-urgent notifications into a daily email
  digest_enabled       boolean DEFAULT false,
  digest_hour          smallint DEFAULT 9,  -- 0-23, hour of day for digest
  -- Timezone for digest scheduling
  timezone             text DEFAULT 'Europe/Madrid',
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now(),
  UNIQUE(brand_id)
);

CREATE INDEX IF NOT EXISTS idx_notif_prefs_brand ON notification_preferences(brand_id);

-- ─── 2. Dashboard metrics snapshot (weekly cache) ────────────────────────────

CREATE TABLE IF NOT EXISTS brand_metrics_weekly (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  week_start    date NOT NULL,  -- Monday of the week
  -- Engagement metrics
  total_posts       int DEFAULT 0,
  total_impressions bigint DEFAULT 0,
  total_reach       bigint DEFAULT 0,
  total_likes       int DEFAULT 0,
  total_comments    int DEFAULT 0,
  total_saves       int DEFAULT 0,
  total_shares      int DEFAULT 0,
  avg_engagement_rate numeric(5,2) DEFAULT 0,
  -- Computed comparisons
  impressions_change_pct numeric(6,2),  -- vs previous week
  reach_change_pct       numeric(6,2),
  engagement_change_pct  numeric(6,2),
  -- Best performing
  best_post_id   uuid,
  best_hour      smallint,
  best_day       smallint,  -- 0=Sun, 1=Mon...
  -- Snapshot timestamp
  computed_at    timestamptz DEFAULT now(),
  UNIQUE(brand_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_brand_metrics_weekly ON brand_metrics_weekly(brand_id, week_start DESC);

-- ─── 3. Recurring posts ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recurring_posts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id       uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  -- Template content
  title          text NOT NULL,              -- "Menu del dia"
  caption_template text,                     -- with {{date}}, {{day}} placeholders
  hashtags       text[] DEFAULT '{}',
  category_key   text,                       -- from content_categories
  format         text DEFAULT 'foto',        -- foto, carrusel, reel, story
  -- Visual
  image_prompt   text,                       -- AI generation prompt (if no fixed image)
  fixed_image_url text,                      -- use this exact image every time
  -- Schedule
  frequency      text NOT NULL DEFAULT 'weekly',  -- daily, weekly, biweekly, monthly
  day_of_week    smallint[],                 -- 0=Sun..6=Sat (for weekly/biweekly)
  day_of_month   smallint,                   -- 1-28 (for monthly)
  preferred_hour smallint DEFAULT 12,        -- 0-23
  -- Control
  active         boolean DEFAULT true,
  auto_publish   boolean DEFAULT false,      -- true = skip approval
  generate_image boolean DEFAULT true,       -- generate new image each time
  generate_caption boolean DEFAULT true,     -- generate new caption each time
  -- Tracking
  last_generated_at timestamptz,
  next_scheduled_at timestamptz,
  total_generated   int DEFAULT 0,
  created_by     uuid,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recurring_posts_brand ON recurring_posts(brand_id, active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_recurring_posts_next ON recurring_posts(next_scheduled_at) WHERE active = true;

-- ─── 4. Onboarding content trigger tracking ─────────────────────────────────

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS onboarding_content_triggered boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_content_at timestamptz;
