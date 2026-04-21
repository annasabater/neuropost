-- Sprint 1: Visual Strategist Agent schema
--
-- New columns on posts:
--   agent_brief                — structured AgentBrief JSON produced by VisualStrategistAgent
--   agent_brief_generated_at   — timestamp when the brief was last produced
--   delivery_mode              — 'instant' (skip review) | 'reviewed' (worker approves before publish)
--
-- New table: post_revisions
--   Tracks every generation attempt so workers can compare versions and costs.

-- ── posts columns ──────────────────────────────────────────────────────────────
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS agent_brief               jsonb,
  ADD COLUMN IF NOT EXISTS agent_brief_generated_at  timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_mode             text
    CHECK (delivery_mode IN ('instant', 'reviewed'))
    DEFAULT 'reviewed';

UPDATE public.posts
SET delivery_mode = 'reviewed'
WHERE delivery_mode IS NULL;

-- ── post_revisions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.post_revisions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id          uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  brand_id         uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  agent_job_id     uuid REFERENCES public.agent_jobs(id) ON DELETE SET NULL,
  revision_index   integer NOT NULL DEFAULT 0,
  prompt           text,
  model            text,
  strength         numeric(4,2),
  guidance         numeric(4,2),
  image_url        text,
  cost_usd         numeric(10,6),
  duration_seconds integer,
  brief_snapshot   jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- indexes
CREATE INDEX IF NOT EXISTS post_revisions_post_id_idx    ON public.post_revisions (post_id);
CREATE INDEX IF NOT EXISTS post_revisions_brand_id_idx   ON public.post_revisions (brand_id);
CREATE INDEX IF NOT EXISTS post_revisions_created_at_idx ON public.post_revisions (created_at DESC);

-- RLS
ALTER TABLE public.post_revisions ENABLE ROW LEVEL SECURITY;

-- clients: see their own brand's revisions
CREATE POLICY "clients_read_own_post_revisions"
  ON public.post_revisions
  FOR SELECT
  USING (
    brand_id IN (
      SELECT id FROM public.brands WHERE user_id = auth.uid()
    )
  );

-- workers: see all revisions
CREATE POLICY "workers_read_all_post_revisions"
  ON public.post_revisions
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.workers WHERE id = auth.uid())
  );

-- service role (backend writes revisions)
CREATE POLICY "service_role_all_post_revisions"
  ON public.post_revisions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
