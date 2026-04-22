-- ═══════════════════════════════════════════════════════════════════════════
-- Support for strategy:regenerate_idea — variation chains on content_ideas
-- ═══════════════════════════════════════════════════════════════════════════
-- Adds the link from a regenerated idea back to its predecessor, plus the
-- client comment that motivated the variation. content_ideas.status is a
-- free text column (no CHECK/enum at the DB level), so the two new status
-- values ('regenerating', 'replaced_by_variation') do not require a
-- constraint migration. The TS union in types/index.ts is the sole source
-- of truth for allowed values.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.content_ideas
  ADD COLUMN IF NOT EXISTS original_idea_id    UUID
    REFERENCES public.content_ideas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS regeneration_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_content_ideas_original
  ON public.content_ideas(original_idea_id);
