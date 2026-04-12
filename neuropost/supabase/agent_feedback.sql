-- =============================================================================
-- Agent feedback — F6
-- =============================================================================
-- Client decisions on agent outputs: approved / rejected / edited.
-- Feeds two loops:
--   1. Direct (F6): updates content_categories.weight for the idea's category
--      when a strategy job gets feedback — positive bumps weight, negative
--      dampens it. Cheap, immediate.
--   2. Indirect (F6→F4): on rebuild_taxonomy, the brand_voice_doc is enriched
--      with "what the user has been approving/rejecting in the last 30 days"
--      so the LLM takes the feedback into account next time.
--
-- Rejection reasons are free-text, optional. A short controlled list lives in
-- the UI ("tono incorrecto", "visual no encaja", etc.) for analytics friendliness.

CREATE TABLE IF NOT EXISTS public.agent_feedback (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id        UUID NOT NULL REFERENCES public.agent_jobs(id) ON DELETE CASCADE,
  brand_id      UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,

  verdict       TEXT NOT NULL CHECK (verdict IN ('approved', 'rejected', 'edited')),
  comment       TEXT,
  -- Optional: for edited verdicts we can store a JSON patch of what changed,
  -- so the strategy layer can learn "the user always makes captions shorter"
  edit_diff     JSONB,

  category_key  TEXT,         -- denormalized from the job output for fast agg
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_feedback_brand
  ON public.agent_feedback(brand_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_feedback_job
  ON public.agent_feedback(job_id);

CREATE INDEX IF NOT EXISTS idx_agent_feedback_category
  ON public.agent_feedback(brand_id, category_key)
  WHERE category_key IS NOT NULL;

ALTER TABLE public.agent_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_feedback: brand owner all"
  ON public.agent_feedback FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = agent_feedback.brand_id
        AND brands.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = agent_feedback.brand_id
        AND brands.user_id = auth.uid()
    )
  );

CREATE POLICY "agent_feedback: worker read"
  ON public.agent_feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workers
      WHERE workers.id = auth.uid()
        AND workers.is_active = true
    )
  );
