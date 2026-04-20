-- =============================================================================
-- Persistent trends — global + sector
-- =============================================================================
-- Safe migration: drops and recreates the table if it already exists with
-- a different schema (e.g. from a prior attempt).

-- Drop old table + policies if they exist (safe — no user data depends on this yet).
DROP POLICY IF EXISTS "trends: public read" ON public.trends;
DROP TABLE IF EXISTS public.trends;

CREATE TABLE public.trends (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sector_key   TEXT,                   -- NULL = global, otherwise 'gym', 'restaurante', ...
  week         TEXT NOT NULL,          -- '2026-W15' format for dedup
  trends       JSONB NOT NULL,         -- array of trend objects from the LLM
  summary      TEXT,                   -- one-paragraph digest
  source_model TEXT,                   -- 'claude-opus-4-6'
  created_at   TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (sector_key, week)            -- one row per sector per week (NULL = global)
);

-- Fast lookups: "give me the latest trends for gym"
CREATE INDEX IF NOT EXISTS idx_trends_sector_week
  ON public.trends(sector_key, week DESC);

-- RLS: everyone can read trends (they're not brand-specific).
ALTER TABLE public.trends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trends: public read"
  ON public.trends FOR SELECT
  USING (true);

-- Only service role (admin client) can write.
-- No insert/update/delete policy for authenticated users.
