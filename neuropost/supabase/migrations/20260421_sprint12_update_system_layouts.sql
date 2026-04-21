-- Sprint 12: replace placeholder layout_config with real v1 layouts
-- Each layout key maps to a switch case in src/lib/stories/render.tsx

UPDATE public.story_templates SET layout_config = '{
  "version": "v1", "layout": "centered", "story_type": "quote",
  "show_logo": true
}'::jsonb WHERE kind = 'system' AND name = 'Quote Clásica';

UPDATE public.story_templates SET layout_config = '{
  "version": "v1", "layout": "minimal", "story_type": "quote",
  "show_logo": false
}'::jsonb WHERE kind = 'system' AND name = 'Quote Minimal';

UPDATE public.story_templates SET layout_config = '{
  "version": "v1", "layout": "table", "story_type": "schedule"
}'::jsonb WHERE kind = 'system' AND name = 'Horario Semanal';

UPDATE public.story_templates SET layout_config = '{
  "version": "v1", "layout": "hero", "story_type": "schedule"
}'::jsonb WHERE kind = 'system' AND name = 'Horario Destacado';

UPDATE public.story_templates SET layout_config = '{
  "version": "v1", "layout": "banner", "story_type": "promo",
  "show_cta": true
}'::jsonb WHERE kind = 'system' AND name = 'Promo Banner';

UPDATE public.story_templates SET layout_config = '{
  "version": "v1", "layout": "urgent", "story_type": "promo",
  "dark_bg": true
}'::jsonb WHERE kind = 'system' AND name = 'Promo Urgente';

UPDATE public.story_templates SET layout_config = '{
  "version": "v1", "layout": "stat", "story_type": "data"
}'::jsonb WHERE kind = 'system' AND name = 'Dato Destacado';

UPDATE public.story_templates SET layout_config = '{
  "version": "v1", "layout": "tagline", "story_type": "quote",
  "show_divider": true
}'::jsonb WHERE kind = 'system' AND name = 'Lema de Marca';

UPDATE public.story_templates SET layout_config = '{
  "version": "v1", "layout": "overlay", "story_type": "photo"
}'::jsonb WHERE kind = 'system' AND name = 'Foto con Overlay';

UPDATE public.story_templates SET layout_config = '{
  "version": "v1", "layout": "flexible", "story_type": "custom"
}'::jsonb WHERE kind = 'system' AND name = 'Contenido Libre';
