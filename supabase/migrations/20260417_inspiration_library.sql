-- =============================================================================
-- NEUROPOST — Inspiration Library: add missing columns to inspiration_references
-- =============================================================================

-- is_favorite: replaces localStorage-based favorites
ALTER TABLE public.inspiration_references
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

-- classified_at: NULL = pending worker review, NOT NULL = confirmed by worker
ALTER TABLE public.inspiration_references
  ADD COLUMN IF NOT EXISTS classified_at timestamptz;

-- usage_count: increments each time "Recrear" is triggered
ALTER TABLE public.inspiration_references
  ADD COLUMN IF NOT EXISTS usage_count integer NOT NULL DEFAULT 0;

-- description_short: agent-extracted scene summary (max ~120 chars)
ALTER TABLE public.inspiration_references
  ADD COLUMN IF NOT EXISTS description_short text;

-- reusability_score: 1–5 score set by agent (4+ = "template-like")
ALTER TABLE public.inspiration_references
  ADD COLUMN IF NOT EXISTS reusability_score integer CHECK (reusability_score BETWEEN 1 AND 5);

-- tags: free-form array set by Inspiration Agent (replaces style_tags as main taxonomy)
-- style_tags already exists, so we add a dedicated tags[] column for agent tags
ALTER TABLE public.inspiration_references
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

-- ── Indexes ──────────────────────────────────────────────────────────────────

-- Main list query: brand + favorite + reusability + usage
CREATE INDEX IF NOT EXISTS inspirations_list_idx
  ON public.inspiration_references (brand_id, is_favorite, reusability_score DESC, usage_count DESC);

-- Tag search with GIN
CREATE INDEX IF NOT EXISTS inspirations_tags_gin_idx
  ON public.inspiration_references USING gin(tags);

-- classified_at for "sin clasificar" filter
CREATE INDEX IF NOT EXISTS inspirations_classified_idx
  ON public.inspiration_references (brand_id, classified_at)
  WHERE classified_at IS NULL;

-- ── RLS: inherit existing policies (no new policies needed) ──────────────────
-- inspiration_references already has RLS enabled with brand_id-scoped policies
