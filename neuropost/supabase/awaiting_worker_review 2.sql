-- ═══════════════════════════════════════════════════════════════════════════
-- awaiting_worker_review gate on content_ideas
-- ═══════════════════════════════════════════════════════════════════════════
-- Set to TRUE by the regenerate_idea handler when routeIdea decides the
-- variation needs worker_review. Cleared to FALSE the moment the worker
-- first acts on the idea (edit via PATCH, plan approve, plan reject).
-- The client UI filters rows with TRUE so the variation does not reach
-- the client until the worker has handled it.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.content_ideas
  ADD COLUMN IF NOT EXISTS awaiting_worker_review BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index: queries for the "changes requested" queue only care
-- about rows where the flag is TRUE. Keeps the index tiny as the
-- content_ideas table grows.
CREATE INDEX IF NOT EXISTS idx_content_ideas_awaiting_worker_review
  ON public.content_ideas (awaiting_worker_review)
  WHERE awaiting_worker_review IS TRUE;

-- TODO follow-up: consider adding a Postgres trigger that clears
-- awaiting_worker_review to FALSE automatically whenever any column
-- of content_ideas changes (except the flag itself). This would guard
-- against new worker endpoints forgetting to clear the flag. Deferred
-- out of this commit — for now the three known worker endpoints
-- (PATCH idea, POST approve, POST reject) clear it explicitly.
