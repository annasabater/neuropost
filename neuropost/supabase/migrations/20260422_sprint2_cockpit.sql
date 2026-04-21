-- Sprint 2: Worker Cockpit — additional columns for post_revisions + posts
-- Adds worker-driven regeneration tracking, error state, and manual uploads.

ALTER TABLE public.post_revisions
  ADD COLUMN IF NOT EXISTS negative_prompt  text,
  ADD COLUMN IF NOT EXISTS num_outputs      integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS triggered_by     text
    CHECK (triggered_by IN ('agent', 'worker', 'client'))
    DEFAULT 'agent',
  ADD COLUMN IF NOT EXISTS worker_id        uuid,
  ADD COLUMN IF NOT EXISTS error_message    text;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS worker_notes text;

-- Workers need INSERT + UPDATE (to fill image_url / error once job completes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'post_revisions'
      AND policyname = 'workers_write_post_revisions'
  ) THEN
    CREATE POLICY "workers_write_post_revisions"
      ON public.post_revisions
      FOR ALL
      USING (EXISTS (SELECT 1 FROM public.workers WHERE id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.workers WHERE id = auth.uid()));
  END IF;
END $$;
