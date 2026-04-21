-- Sprint 10: brand_material table

CREATE TABLE IF NOT EXISTS public.brand_material (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  category      text NOT NULL,
  content       jsonb NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  valid_until   timestamptz,
  display_order int DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT brand_material_category_check
    CHECK (category IN ('schedule','promo','data','quote','free'))
);

COMMENT ON TABLE public.brand_material IS
'Material de marca que alimenta el generador de historias.
Estructura de content según category:
- schedule: { "days": [{ "day": "monday", "hours": "7-22" }, ...] }
- promo:    { "title": "...", "description": "...", "url": "..." }
- data:     { "label": "15 años", "description": "de experiencia" }
- quote:    { "text": "...", "author": "opcional" }
- free:     { "text": "..." }';

CREATE INDEX IF NOT EXISTS idx_brand_material_brand_active
  ON public.brand_material(brand_id, active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_brand_material_brand_category
  ON public.brand_material(brand_id, category);

ALTER TABLE public.brand_material ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brand_material_client_all ON public.brand_material;
CREATE POLICY brand_material_client_all ON public.brand_material
  FOR ALL USING (
    brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid())
    OR auth.role() = 'service_role'
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_brand_material_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_brand_material_updated_at ON public.brand_material;
CREATE TRIGGER trigger_brand_material_updated_at
  BEFORE UPDATE ON public.brand_material
  FOR EACH ROW EXECUTE FUNCTION public.update_brand_material_updated_at();
