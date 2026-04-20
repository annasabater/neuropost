-- ═══════════════════════════════════════════════════════════════════════════════
-- Worker observability, manual claim, provider costs, agent alerts
-- 2026-04-17
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Ensure worker_profiles exists before adding FK references ─────────────────
-- (Created in 20260410_worker_portal.sql — this block is a safety net)
CREATE TABLE IF NOT EXISTS worker_profiles (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name  text NOT NULL,
  email         text NOT NULL,
  avatar_url    text,
  role          text NOT NULL DEFAULT 'worker' CHECK (role IN ('owner','admin','senior','worker','viewer')),
  department    text CHECK (department IN ('content','community','sales','support','management')),
  is_active     boolean DEFAULT true,
  permissions   jsonb DEFAULT '{}',
  last_login_at timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- ── agent_jobs: manual claim fields ──────────────────────────────────────────
ALTER TABLE agent_jobs ADD COLUMN IF NOT EXISTS claimed_by uuid REFERENCES worker_profiles(id);
ALTER TABLE agent_jobs ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
ALTER TABLE agent_jobs ADD COLUMN IF NOT EXISTS processing_timeline jsonb DEFAULT '[]';

-- ── posts: video thumbnail ────────────────────────────────────────────────────
ALTER TABLE posts ADD COLUMN IF NOT EXISTS thumbnail_url text;

-- ── Indexes for agent metrics queries ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_agent_jobs_status_action
  ON agent_jobs(status, agent_type, action);

CREATE INDEX IF NOT EXISTS idx_agent_jobs_completed_at
  ON agent_jobs(finished_at)
  WHERE status = 'done';

CREATE INDEX IF NOT EXISTS idx_agent_jobs_claimed
  ON agent_jobs(claimed_by)
  WHERE claimed_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_jobs_running
  ON agent_jobs(status)
  WHERE status = 'running';

-- ── provider_costs: track cost per API call ───────────────────────────────────
CREATE TABLE IF NOT EXISTS provider_costs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_job_id     uuid REFERENCES agent_jobs(id) ON DELETE SET NULL,
  brand_id         uuid REFERENCES brands(id) ON DELETE CASCADE,
  provider         text NOT NULL,          -- 'replicate', 'higgsfield', 'claude', 'runway', 'nanobanana'
  action           text NOT NULL,          -- 'generate_image', 'generate_video', etc.
  cost_usd         numeric(10,6) NOT NULL,
  tokens_input     integer,                -- only for LLM providers
  tokens_output    integer,
  duration_seconds numeric(8,2),
  model            text,                   -- 'flux-dev', 'claude-sonnet-4-20250514', etc.
  metadata         jsonb,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_costs_brand       ON provider_costs(brand_id);
CREATE INDEX IF NOT EXISTS idx_provider_costs_provider    ON provider_costs(provider, created_at);
CREATE INDEX IF NOT EXISTS idx_provider_costs_date        ON provider_costs(created_at);
CREATE INDEX IF NOT EXISTS idx_provider_costs_brand_month ON provider_costs(brand_id, created_at);

-- ── agent_alerts: active alerts for dashboard ────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_alerts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_key       text NOT NULL,          -- 'content:generate_image'
  alert_type      text NOT NULL,          -- 'saturated', 'high_failure', 'stuck_job', 'long_queue'
  severity        text DEFAULT 'warning'
                  CHECK (severity IN ('warning', 'critical')),
  message         text NOT NULL,
  related_job_id  uuid REFERENCES agent_jobs(id),
  acknowledged    boolean DEFAULT false,
  acknowledged_by uuid REFERENCES worker_profiles(id),
  created_at      timestamptz DEFAULT now(),
  resolved_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_agent_alerts_active
  ON agent_alerts(created_at DESC)
  WHERE acknowledged = false AND resolved_at IS NULL;

-- ── Update claim_agent_jobs RPC to skip manually-claimed jobs ─────────────────
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
  SET status     = 'running',
      started_at = NOW(),
      attempts   = aj.attempts + 1
  WHERE aj.id IN (
    SELECT id FROM public.agent_jobs
    WHERE status = 'pending'
      AND claimed_by IS NULL
      AND (scheduled_for IS NULL OR scheduled_for <= NOW())
    ORDER BY priority DESC, created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING aj.*;
END;
$$;
