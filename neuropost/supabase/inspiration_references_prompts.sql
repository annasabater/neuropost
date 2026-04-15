-- =============================================================================
-- inspiration_references — añadir columnas de análisis de agente
-- =============================================================================
-- Ejecutar en Supabase SQL Editor una vez.
--
-- recreation_prompt: el prompt de fotografía generado por InspirationAgent
--   que se pasa directamente a Replicate/Flux cuando alguien quiere recrear
-- style_analysis:    JSON con composición, iluminación, paleta, mood, elementos
-- worker_instructions: instrucciones en texto para el worker
-- analysis_status:   'pending' | 'analyzing' | 'done' | 'failed'

ALTER TABLE inspiration_references
  ADD COLUMN IF NOT EXISTS recreation_prompt     text,
  ADD COLUMN IF NOT EXISTS style_analysis        jsonb,
  ADD COLUMN IF NOT EXISTS worker_instructions   text,
  ADD COLUMN IF NOT EXISTS suggested_caption     text,
  ADD COLUMN IF NOT EXISTS suggested_hashtags    text[],
  ADD COLUMN IF NOT EXISTS analysis_status       text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS category              text;

-- Index for fast lookup of unanalyzed references
CREATE INDEX IF NOT EXISTS idx_inspiration_refs_analysis_pending
  ON inspiration_references (analysis_status, created_at DESC)
  WHERE analysis_status = 'pending';
