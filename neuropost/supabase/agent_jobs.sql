-- =============================================================================
-- Agent Jobs — F1 Base Infrastructure
-- =============================================================================
-- Unified job queue for all agent actions (content, strategy, support,
-- analytics, moderation, scheduling, growth). Processed by the cron runner
-- at /api/cron/agent-queue-runner every minute.
--
-- Clients write jobs via /api/agent-jobs.
-- Workers write jobs via /api/worker/agent-jobs.
-- Agents emit sub-jobs via parent_job_id (orchestration without direct calls).

CREATE TABLE IF NOT EXISTS public.agent_jobs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id        UUID REFERENCES public.brands(id) ON DELETE CASCADE,

  agent_type      TEXT NOT NULL,           -- 'content' | 'strategy' | 'support' | 'analytics' | 'moderation' | 'scheduling' | 'growth'
  action          TEXT NOT NULL,           -- 'generate_post' | 'plan_week' | 'classify_message' | ...
  input           JSONB NOT NULL DEFAULT '{}'::jsonb,

  status          TEXT NOT NULL DEFAULT 'pending',
                  -- 'pending' | 'running' | 'done' | 'error' | 'needs_review' | 'cancelled'
  priority        INT DEFAULT 50,          -- 0-100, higher runs first

  attempts        INT DEFAULT 0,
  max_attempts    INT DEFAULT 3,

  requested_by    TEXT,                    -- 'client' | 'worker' | 'cron' | 'agent'
  requester_id    UUID,
  parent_job_id   UUID REFERENCES public.agent_jobs(id) ON DELETE SET NULL,

  scheduled_for   TIMESTAMPTZ,             -- deferred execution
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ,
  error           TEXT,

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Hot path: the runner reads pending jobs ordered by priority/created_at.
CREATE INDEX IF NOT EXISTS idx_agent_jobs_pending
  ON public.agent_jobs(priority DESC, created_at ASC)
  WHERE status = 'pending';

-- Clients / workers list recent jobs per brand.
CREATE INDEX IF NOT EXISTS idx_agent_jobs_brand
  ON public.agent_jobs(brand_id, created_at DESC);

-- Parent → children lookups for orchestration trees.
CREATE INDEX IF NOT EXISTS idx_agent_jobs_parent
  ON public.agent_jobs(parent_job_id)
  WHERE parent_job_id IS NOT NULL;

ALTER TABLE public.agent_jobs ENABLE ROW LEVEL SECURITY;

-- Brand owners can read their own jobs
CREATE POLICY "agent_jobs: brand owner read"
  ON public.agent_jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = agent_jobs.brand_id
        AND brands.user_id = auth.uid()
    )
  );

-- Brand owners can insert jobs for their own brand
CREATE POLICY "agent_jobs: brand owner insert"
  ON public.agent_jobs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = agent_jobs.brand_id
        AND brands.user_id = auth.uid()
    )
  );

-- Active workers can read/update ALL jobs
CREATE POLICY "agent_jobs: worker read"
  ON public.agent_jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workers
      WHERE workers.id = auth.uid()
        AND workers.is_active = true
    )
  );

CREATE POLICY "agent_jobs: worker update"
  ON public.agent_jobs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workers
      WHERE workers.id = auth.uid()
        AND workers.is_active = true
    )
  );

-- =============================================================================
-- Agent Outputs — every job that completes writes one or more outputs.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.agent_outputs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id       UUID NOT NULL REFERENCES public.agent_jobs(id) ON DELETE CASCADE,
  brand_id     UUID REFERENCES public.brands(id) ON DELETE CASCADE,

  kind         TEXT NOT NULL,               -- 'post' | 'caption' | 'image' | 'video' | 'reply' | 'strategy' | 'analysis' | 'schedule'
  payload      JSONB NOT NULL,              -- the actual result
  preview_url  TEXT,                        -- thumbnail / first frame

  cost_usd     NUMERIC,                     -- for per-brand budget tracking
  tokens_used  INT,
  model        TEXT,                        -- 'claude-sonnet-4-6' | 'nanobanana-v3' | ...

  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_outputs_job
  ON public.agent_outputs(job_id);

CREATE INDEX IF NOT EXISTS idx_agent_outputs_brand
  ON public.agent_outputs(brand_id, created_at DESC);

ALTER TABLE public.agent_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_outputs: brand owner read"
  ON public.agent_outputs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = agent_outputs.brand_id
        AND brands.user_id = auth.uid()
    )
  );

CREATE POLICY "agent_outputs: worker read"
  ON public.agent_outputs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workers
      WHERE workers.id = auth.uid()
        AND workers.is_active = true
    )
  );

-- =============================================================================
-- Atomic job claim helper
-- =============================================================================
-- The runner uses this to safely claim a batch of pending jobs without races.
-- SELECT ... FOR UPDATE SKIP LOCKED is the standard Postgres pattern.

CREATE OR REPLACE FUNCTION public.claim_agent_jobs(
  p_limit INT DEFAULT 10
)
RETURNS SETOF public.agent_jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.agent_jobs aj
  SET status       = 'running',
      started_at   = NOW(),
      attempts     = aj.attempts + 1
  WHERE aj.id IN (
    SELECT id FROM public.agent_jobs
    WHERE status = 'pending'
      AND (scheduled_for IS NULL OR scheduled_for <= NOW())
    ORDER BY priority DESC, created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING aj.*;
END;
$$;
