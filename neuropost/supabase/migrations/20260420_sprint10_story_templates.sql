-- Sprint 10: story_templates table + 10 system seeds

CREATE TABLE IF NOT EXISTS public.story_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        text NOT NULL,
  brand_id    uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  name        text NOT NULL,
  layout_config jsonb NOT NULL,
  preview_url text,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT story_templates_kind_check CHECK (kind IN ('system', 'custom'))
);

CREATE INDEX IF NOT EXISTS idx_story_templates_kind
  ON public.story_templates(kind);
CREATE INDEX IF NOT EXISTS idx_story_templates_brand
  ON public.story_templates(brand_id) WHERE kind = 'custom';

ALTER TABLE public.story_templates ENABLE ROW LEVEL SECURITY;

-- SELECT: system templates readable by all auth'd users, workers, and service_role;
--         custom templates readable by the owning brand user + workers + service_role
DROP POLICY IF EXISTS story_templates_select ON public.story_templates;
CREATE POLICY story_templates_select ON public.story_templates
  FOR SELECT USING (
    kind = 'system'
    OR brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.workers WHERE id = auth.uid() AND is_active = true)
    OR auth.role() = 'service_role'
  );

-- INSERT: only brand owners can create custom templates
DROP POLICY IF EXISTS story_templates_insert ON public.story_templates;
CREATE POLICY story_templates_insert ON public.story_templates
  FOR INSERT WITH CHECK (
    (kind = 'custom'
      AND brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    OR auth.role() = 'service_role'
  );

-- UPDATE: only brand owners can update their own custom templates
DROP POLICY IF EXISTS story_templates_update ON public.story_templates;
CREATE POLICY story_templates_update ON public.story_templates
  FOR UPDATE USING (
    (kind = 'custom'
      AND brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    OR auth.role() = 'service_role'
  );

-- DELETE: only brand owners can delete their own custom templates
DROP POLICY IF EXISTS story_templates_delete ON public.story_templates;
CREATE POLICY story_templates_delete ON public.story_templates
  FOR DELETE USING (
    (kind = 'custom'
      AND brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    OR auth.role() = 'service_role'
  );

-- ─── 10 system seeds ──────────────────────────────────────────────────────────

INSERT INTO public.story_templates (kind, brand_id, name, layout_config) VALUES
  ('system', NULL, 'Quote Clásica',       '{"placeholder":true,"version":"v1","story_type":"quote","layout":"centered","background":"brand_color","logo":"corner"}'),
  ('system', NULL, 'Quote Minimal',       '{"placeholder":true,"version":"v1","story_type":"quote","layout":"minimal","background":"white","font_size":"xl"}'),
  ('system', NULL, 'Horario Semanal',     '{"placeholder":true,"version":"v1","story_type":"schedule","layout":"table","columns":["day","hours"]}'),
  ('system', NULL, 'Horario Destacado',   '{"placeholder":true,"version":"v1","story_type":"schedule","layout":"hero","highlight":"today"}'),
  ('system', NULL, 'Promo Banner',        '{"placeholder":true,"version":"v1","story_type":"promo","layout":"banner","elements":["title","description","cta"]}'),
  ('system', NULL, 'Promo Urgente',       '{"placeholder":true,"version":"v1","story_type":"promo","layout":"urgent","background":"accent","countdown":true}'),
  ('system', NULL, 'Dato Destacado',      '{"placeholder":true,"version":"v1","story_type":"data","layout":"stat","number_size":"4xl","label_size":"lg"}'),
  ('system', NULL, 'Lema de Marca',       '{"placeholder":true,"version":"v1","story_type":"quote","layout":"tagline","typography":"bold_centered"}'),
  ('system', NULL, 'Foto con Overlay',    '{"placeholder":true,"version":"v1","story_type":"photo","layout":"overlay","text_position":"bottom"}'),
  ('system', NULL, 'Contenido Libre',     '{"placeholder":true,"version":"v1","story_type":"custom","layout":"flexible","elements":["text","image"]}')
ON CONFLICT DO NOTHING;
