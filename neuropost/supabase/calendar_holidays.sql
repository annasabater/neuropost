-- =============================================================================
-- Migration: Calendar events (holiday detection) + city column in brands
-- Run in Supabase SQL Editor
-- =============================================================================

-- ── City column in brands ────────────────────────────────────────────────────
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS city text;

-- ── calendar_events table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id              uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  title                 text NOT NULL,
  date                  date NOT NULL,
  type                  text NOT NULL DEFAULT 'holiday',
  -- 'holiday' | 'cultural' | 'commercial' | 'local' | 'awareness'
  description           text,
  relevance             text NOT NULL DEFAULT 'medium',
  -- 'high' | 'medium' | 'low'
  suggested_content_idea text,
  country               text,
  region                text,
  city                  text,
  source                text NOT NULL DEFAULT 'agent',
  -- 'agent' | 'manual'
  year                  int,
  created_at            timestamptz DEFAULT now(),
  UNIQUE (brand_id, date, title)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_brand_date
  ON calendar_events(brand_id, date);

CREATE INDEX IF NOT EXISTS idx_calendar_events_brand_year
  ON calendar_events(brand_id, year);

-- ── calendar_events_generated_at in brands ───────────────────────────────────
-- Tracks when the holiday agent last ran for this brand (for the 2-month refresh cron)
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS calendar_events_generated_at timestamptz;

-- Verify
SELECT column_name FROM information_schema.columns
WHERE table_name = 'brands'
  AND column_name IN ('city', 'calendar_events_generated_at');

SELECT count(*) FROM information_schema.tables
WHERE table_name = 'calendar_events';
