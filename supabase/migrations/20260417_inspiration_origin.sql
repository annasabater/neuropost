-- =============================================================================
-- NEUROPOST — Inspiration: add origin + source_handle to inspiration_references
-- =============================================================================
--
-- origin: where this reference came from
--   'editorial'   = curated by the NeuroPost team / agent
--   'user_saved'  = uploaded/linked by the client directly
--   'ai_generated'= produced by the Ideas AI for this specific brand
--
-- source_handle: optional @handle or domain shown on "Guardado por ti" badge
--   ej: "@heladeriamarta", "instagram.com/..."

ALTER TABLE public.inspiration_references
  ADD COLUMN IF NOT EXISTS origin text
    CHECK (origin IN ('editorial', 'user_saved', 'ai_generated'))
    DEFAULT 'user_saved';

ALTER TABLE public.inspiration_references
  ADD COLUMN IF NOT EXISTS source_handle text;

-- Backfill: existing rows with type='template' are editorial content
UPDATE public.inspiration_references
  SET origin = 'editorial'
  WHERE type = 'template' AND origin = 'user_saved';

-- Index for the origin filter used in /api/inspiracion/list
CREATE INDEX IF NOT EXISTS inspirations_origin_idx
  ON public.inspiration_references (brand_id, origin);
