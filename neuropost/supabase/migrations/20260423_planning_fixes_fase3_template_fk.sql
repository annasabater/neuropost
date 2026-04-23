-- =============================================================================
-- Planning Fixes Fase 3 — P9: FK constraint on content_ideas.template_id
-- =============================================================================
-- Pre-migration check confirmed 0 orphan template_ids in production.
-- Defensive UPDATE included anyway to guard against any edge cases.
--
-- FK policy: ON DELETE SET NULL — deleting a template nulls the reference
-- rather than blocking the delete or cascading to ideas.
-- =============================================================================

BEGIN;

-- Defensive cleanup: clear any template_id values pointing to templates
-- that no longer exist. Investigation confirmed 0 orphans; this is a safety
-- net in case of any race between investigation and migration time.
UPDATE public.content_ideas
SET template_id = NULL
WHERE template_id IS NOT NULL
  AND template_id NOT IN (SELECT id FROM public.story_templates);

-- Drop existing constraint if it exists (makes migration idempotent / re-runnable)
ALTER TABLE public.content_ideas
  DROP CONSTRAINT IF EXISTS fk_content_ideas_template_id;

-- Add FK with ON DELETE SET NULL
ALTER TABLE public.content_ideas
  ADD CONSTRAINT fk_content_ideas_template_id
  FOREIGN KEY (template_id)
  REFERENCES public.story_templates(id)
  ON DELETE SET NULL;

COMMIT;
