-- =============================================================================
-- POSTLY — Phase 3 Schema Additions
-- Run after: schema.sql, schema_additions.sql, schema_admin.sql, schema_agents_advanced.sql
-- =============================================================================

-- ─── Ensure brands has all Phase 3 columns ───────────────────────────────────

-- slogans array (already in Brand type, ensure column exists)
ALTER TABLE brands ADD COLUMN IF NOT EXISTS slogans TEXT[] DEFAULT '{}';

-- colors jsonb (brand colors from onboarding)
ALTER TABLE brands ADD COLUMN IF NOT EXISTS colors JSONB DEFAULT NULL;

-- fonts jsonb (brand typography)
ALTER TABLE brands ADD COLUMN IF NOT EXISTS fonts JSONB DEFAULT NULL;

-- faq jsonb array (FAQ entries)
ALTER TABLE brands ADD COLUMN IF NOT EXISTS faq JSONB DEFAULT NULL;

-- publish_mode enum (already in type, ensure it's there)
DO $$ BEGIN
  CREATE TYPE publish_mode_type AS ENUM ('manual', 'semi', 'auto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE brands ADD COLUMN IF NOT EXISTS publish_mode TEXT NOT NULL DEFAULT 'manual'
  CHECK (publish_mode IN ('manual', 'semi', 'auto'));

-- ─── Posts: ensure versions column exists ───────────────────────────────────
-- versions is a JSONB array of { caption, hashtags, savedAt }
ALTER TABLE posts ADD COLUMN IF NOT EXISTS versions JSONB DEFAULT '[]';

-- ai_explanation column (ensure exists)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS ai_explanation TEXT DEFAULT NULL;

-- ─── Activity log: ensure table exists ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL,
  action      TEXT        NOT NULL,
  entity_type TEXT        NOT NULL,
  entity_id   UUID        DEFAULT NULL,
  details     JSONB       DEFAULT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own brand activity" ON activity_log
  FOR SELECT USING (
    brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid())
  );

CREATE POLICY "Users insert own brand activity" ON activity_log
  FOR INSERT WITH CHECK (
    brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid())
  );

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS activity_log_brand_id_idx ON activity_log(brand_id, created_at DESC);

-- ─── Notifications: add missing types ────────────────────────────────────────
-- notification_type enum may need additional values; use text if already text
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'meta_connected';
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'token_expired';
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_failed';
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'plan_activated';
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'team_invite';
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'trend_detected';
EXCEPTION WHEN others THEN NULL; END $$;

-- ─── Posts: add edit_level column ────────────────────────────────────────────
ALTER TABLE posts ADD COLUMN IF NOT EXISTS edit_level SMALLINT NOT NULL DEFAULT 0 CHECK (edit_level IN (0, 1, 2));

-- ─── Posts: add metrics jsonb ────────────────────────────────────────────────
ALTER TABLE posts ADD COLUMN IF NOT EXISTS metrics JSONB DEFAULT NULL;

-- ─── Indexes for performance ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS posts_brand_status_idx   ON posts(brand_id, status);
CREATE INDEX IF NOT EXISTS posts_brand_created_idx  ON posts(brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifs_brand_read_idx    ON notifications(brand_id, read, created_at DESC);