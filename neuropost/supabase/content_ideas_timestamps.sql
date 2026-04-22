-- GAPs 3+4: Add decision and review timestamps to content_ideas.
-- Enables "time to client decision" and "worker throughput" metrics.

ALTER TABLE public.content_ideas
  ADD COLUMN IF NOT EXISTS approved_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by  UUID,
  ADD COLUMN IF NOT EXISTS rejected_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by  UUID,
  ADD COLUMN IF NOT EXISTS reviewed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by  UUID;

CREATE INDEX IF NOT EXISTS idx_content_ideas_approved_at
  ON public.content_ideas(approved_at DESC)
  WHERE approved_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_ideas_reviewed_at
  ON public.content_ideas(reviewed_at DESC)
  WHERE reviewed_at IS NOT NULL;
