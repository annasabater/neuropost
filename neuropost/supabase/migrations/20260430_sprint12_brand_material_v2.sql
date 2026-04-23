-- Sprint 12: brand_material v2
-- Aditiva + backward-compatible. No dropea valid_until.
-- Añade columnas transversales (priority/platforms/tags/active_from/active_to),
-- backfill active_to <- valid_until, índices, y refuerza RLS con WITH CHECK.

BEGIN;

-- 1. Nuevas columnas transversales (todas safe: NOT NULL con default o nullable)
ALTER TABLE public.brand_material
  ADD COLUMN IF NOT EXISTS priority     int          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platforms    text[]       NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS tags         text[]       NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS active_from  timestamptz,
  ADD COLUMN IF NOT EXISTS active_to    timestamptz;

-- 2. Backfill: copia valid_until -> active_to solo donde active_to aún es NULL.
--    No sobrescribe valid_until. Los lectores legacy siguen viendo el mismo valor.
UPDATE public.brand_material
   SET active_to = valid_until
 WHERE active_to IS NULL
   AND valid_until IS NOT NULL;

-- 3. CHECK sobre platforms: solo valores conocidos. Default '{}' = todas.
ALTER TABLE public.brand_material
  DROP CONSTRAINT IF EXISTS brand_material_platforms_check;

ALTER TABLE public.brand_material
  ADD CONSTRAINT brand_material_platforms_check
  CHECK (platforms <@ ARRAY['instagram','facebook','linkedin','tiktok','x']::text[]);

-- 4. Índices para filtros habituales en agentes y UI
CREATE INDEX IF NOT EXISTS idx_brand_material_brand_priority
  ON public.brand_material (brand_id, priority DESC)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_brand_material_active_window
  ON public.brand_material (brand_id)
  WHERE active = true AND (active_to IS NULL OR active_to > now());

-- 5. Reforzar RLS: mantenemos el USING existente, añadimos WITH CHECK idéntico
--    para impedir inserción/actualización cruzada entre brands.
DROP POLICY IF EXISTS brand_material_client_all ON public.brand_material;

CREATE POLICY brand_material_client_all ON public.brand_material
  FOR ALL
  USING (
    brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid())
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid())
    OR auth.role() = 'service_role'
  );

-- 6. Documentación
COMMENT ON TABLE public.brand_material IS
  'Materiales de marca. content.schema_version indica v1 (legacy) o v2.
   Categorías: schedule, promo, data (Catálogo en UI), quote, free.
   active_to/active_from reemplazan funcionalmente a valid_until, que se
   mantiene por compatibilidad con lectores v1. Sincronizados en escrituras.';

COMMIT;
