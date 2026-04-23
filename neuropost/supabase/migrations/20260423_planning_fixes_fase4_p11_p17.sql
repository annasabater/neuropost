-- =============================================================================
-- Fase 4.C — P11: generation_fallback column
--            P17: image_generation_prompt column + data migration
-- =============================================================================

-- P11: track whether a story's copy was AI-generated or fell back to
--      FALLBACK_QUOTES / verbatim brand material (signals lower quality).
ALTER TABLE content_ideas
  ADD COLUMN IF NOT EXISTS generation_fallback BOOLEAN DEFAULT FALSE;

-- P17: store the Replicate image-generation prompt in its own column instead
--      of encoding it in the `hook` field as "REPLICATE:{prompt}".
ALTER TABLE content_ideas
  ADD COLUMN IF NOT EXISTS image_generation_prompt TEXT;

-- P17 data migration: extract existing REPLICATE: prompts from hook → new column.
-- SUBSTRING(hook FROM 11) strips the 10-char 'REPLICATE:' prefix.
UPDATE content_ideas
  SET image_generation_prompt = SUBSTRING(hook FROM 11),
      hook = NULL
  WHERE hook LIKE 'REPLICATE:%';
