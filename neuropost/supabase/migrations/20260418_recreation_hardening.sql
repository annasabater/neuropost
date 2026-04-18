-- =============================================================================
-- Recreation requests: regeneration quota + generation history + failed status
-- =============================================================================

ALTER TABLE public.recreation_requests
  ADD COLUMN IF NOT EXISTS regeneration_count  integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS generation_history  jsonb   DEFAULT '[]'::jsonb NOT NULL;

-- generation_history shape (append-only):
-- [
--   { "prediction_id": "...", "images": ["url1","url2"],
--     "generated_at": "2026-04-18T12:34:56.000Z", "version": 1 },
--   ...
-- ]
-- `generated_images` always mirrors the currently-active version (last or user-selected).

-- 'failed' is a valid terminal status (set by reconcile cron on timeout / failure).
-- No CHECK constraint to alter — status is plain text.

CREATE INDEX IF NOT EXISTS idx_recreation_requests_preparacion_age
  ON public.recreation_requests (created_at)
  WHERE status = 'preparacion';
