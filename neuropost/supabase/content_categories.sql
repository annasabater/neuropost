-- =============================================================================
-- Content taxonomy — F4 strategy agent
-- =============================================================================
-- Stores the hierarchical content tree built by the strategy agent for each
-- brand (categories → subcategories). Weights evolve over time: initialized
-- by the LLM during build_taxonomy, then recalibrated by the analytics loop
-- (F5) based on real Instagram engagement.
--
-- Hierarchy is flattened via parent_key (self-reference by key, not FK, so
-- the taxonomy can be replaced atomically without cascading deletes).

CREATE TABLE IF NOT EXISTS public.content_categories (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id      UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,

  category_key  TEXT NOT NULL,            -- 'workouts', 'workouts/full_body', ...
  name          TEXT NOT NULL,             -- human-readable
  parent_key    TEXT,                      -- null = top-level category
  description   TEXT,                      -- short rationale from the LLM

  weight        NUMERIC DEFAULT 0,         -- 0.0 - 1.0, normalized per level
  performance_score NUMERIC,               -- rolling 30-day engagement, null until F5
  format_affinity   JSONB,                 -- { reel: 0.45, carrusel: 0.30, foto: 0.25 }
  recommended_formats TEXT[],              -- ['reel', 'carrusel'] — LLM hint

  last_published_at TIMESTAMPTZ,           -- recency decay input (F5)
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (brand_id, category_key)
);

CREATE INDEX IF NOT EXISTS idx_content_categories_brand
  ON public.content_categories(brand_id, weight DESC);

CREATE INDEX IF NOT EXISTS idx_content_categories_parent
  ON public.content_categories(brand_id, parent_key)
  WHERE parent_key IS NOT NULL;

ALTER TABLE public.content_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_categories: brand owner all"
  ON public.content_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = content_categories.brand_id
        AND brands.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = content_categories.brand_id
        AND brands.user_id = auth.uid()
    )
  );

CREATE POLICY "content_categories: worker read"
  ON public.content_categories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workers
      WHERE workers.id = auth.uid()
        AND workers.is_active = true
    )
  );

-- Keep updated_at fresh on any update.
CREATE OR REPLACE FUNCTION public.touch_content_categories_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS content_categories_touch ON public.content_categories;
CREATE TRIGGER content_categories_touch
  BEFORE UPDATE ON public.content_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_content_categories_updated_at();
