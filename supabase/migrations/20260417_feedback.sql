-- =============================================================================
-- NEUROPOST — Feedback table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.feedback (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id   uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  rating     integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  message    text,
  page       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for dashboard queries
CREATE INDEX IF NOT EXISTS feedback_user_id_idx ON public.feedback(user_id);
CREATE INDEX IF NOT EXISTS feedback_created_at_idx ON public.feedback(created_at DESC);

-- RLS: users can insert their own feedback; workers/admins can read all
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feedback_insert_own" ON public.feedback;
CREATE POLICY "feedback_insert_own"
  ON public.feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "feedback_select_own" ON public.feedback;
CREATE POLICY "feedback_select_own"
  ON public.feedback FOR SELECT
  USING (auth.uid() = user_id);

-- Grant service role full access (for API route)
GRANT ALL ON public.feedback TO service_role;
GRANT SELECT ON public.feedback TO authenticated;
