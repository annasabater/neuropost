-- =============================================================================
-- 20260424_brand_kit_creative_direction.sql — Phase 1
-- =============================================================================
-- Adds 6 creative-direction columns to public.brands. All nullable with
-- sensible defaults. Not yet consumed by the generation pipeline — Phases
-- 2-5 will read from them to drive layouts, image prompts, and ephemeris
-- graphics.
--
-- Idempotent: all ADD COLUMN statements use IF NOT EXISTS.
-- =============================================================================

BEGIN;

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS aesthetic_preset text
    DEFAULT 'editorial',
  ADD COLUMN IF NOT EXISTS realism_level integer
    DEFAULT 70,
  ADD COLUMN IF NOT EXISTS typography_display text
    DEFAULT 'barlow_condensed',
  ADD COLUMN IF NOT EXISTS typography_body text
    DEFAULT 'barlow',
  ADD COLUMN IF NOT EXISTS allow_graphic_elements boolean NOT NULL
    DEFAULT true,
  ADD COLUMN IF NOT EXISTS overlay_intensity text
    DEFAULT 'medium';

-- Constraints are applied as separate statements for idempotency (cannot
-- use IF NOT EXISTS with ADD CONSTRAINT in a portable way).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'brands_aesthetic_preset_check'
  ) THEN
    ALTER TABLE public.brands
      ADD CONSTRAINT brands_aesthetic_preset_check
      CHECK (aesthetic_preset IS NULL OR aesthetic_preset IN
        ('moody','creativo','editorial','natural','minimalista','clasico','luxury','vintage'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'brands_realism_level_check'
  ) THEN
    ALTER TABLE public.brands
      ADD CONSTRAINT brands_realism_level_check
      CHECK (realism_level IS NULL OR (realism_level BETWEEN 0 AND 100));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'brands_overlay_intensity_check'
  ) THEN
    ALTER TABLE public.brands
      ADD CONSTRAINT brands_overlay_intensity_check
      CHECK (overlay_intensity IS NULL OR overlay_intensity IN
        ('none','subtle','medium','strong'));
  END IF;
END
$$;

COMMENT ON COLUMN public.brands.aesthetic_preset IS
  'One of 8 aesthetic presets. Drives creative direction in planning.';
COMMENT ON COLUMN public.brands.realism_level IS
  '0=fully artistic/illustrated, 100=photorealistic. Modulates image generation prompts.';
COMMENT ON COLUMN public.brands.typography_display IS
  'Font id from src/lib/stories/fonts-catalog.ts (role=display).';
COMMENT ON COLUMN public.brands.typography_body IS
  'Font id from src/lib/stories/fonts-catalog.ts (role=body).';
COMMENT ON COLUMN public.brands.allow_graphic_elements IS
  'If true, agent may add decorative graphic elements on ephemerides (roses on Sant Jordi, etc.).';
COMMENT ON COLUMN public.brands.overlay_intensity IS
  'Strength of dark overlay on photo layouts: none|subtle|medium|strong.';

COMMIT;
