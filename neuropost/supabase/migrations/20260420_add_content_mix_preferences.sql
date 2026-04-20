-- Sprint 9: add content_mix_preferences to brands
-- Stores client's preferred post format breakdown per week.
-- Applies to the next generated plan, not the current one.

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS content_mix_preferences jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.brands.content_mix_preferences IS
'Preferencias de mix de contenido del cliente. Estructura:
{
  "posts": { "carousel": 2, "reel": 2 },
  "stories_templates_enabled": ["template_id_1"]
}
Aplica al siguiente plan generado. Valores deben respetar las cuotas del plan.';
