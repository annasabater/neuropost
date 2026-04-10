-- ═══════════════════════════════════════════════════════════════════════════════
-- Agent Pipeline Tables
-- ═══════════════════════════════════════════════════════════════════════════════

-- Agent execution logs
CREATE TABLE IF NOT EXISTS agent_logs (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_name    text NOT NULL,
  brand_id      uuid REFERENCES brands(id) ON DELETE SET NULL,
  status        text NOT NULL DEFAULT 'success',  -- success | error | skipped
  details       jsonb DEFAULT '{}',
  duration_ms   integer,
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX agent_logs_agent_name_idx ON agent_logs(agent_name);
CREATE INDEX agent_logs_created_at_idx ON agent_logs(created_at DESC);

-- Weekly proposals (Content Strategist output)
CREATE TABLE IF NOT EXISTS proposals (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id        uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  week_start      date NOT NULL,
  -- Proposal data
  orden           integer NOT NULL DEFAULT 1,
  tipo            text NOT NULL DEFAULT 'foto',          -- foto | reel | carrusel | story
  categoria       text NOT NULL DEFAULT 'branding',
  tema            text NOT NULL,
  concepto        text,
  objetivo        text,
  dia_publicacion date,
  hora_publicacion text,
  plataforma      text DEFAULT 'instagram',
  brief_visual    jsonb DEFAULT '{}',
  brief_copy      jsonb DEFAULT '{}',
  -- Pipeline status
  status          text NOT NULL DEFAULT 'pending_copy',  -- pending_copy | processing_copy | copy_done | pending_visual | generating_visual | pending_qc | processing_qc | approved | rejected | failed
  retry_count     integer DEFAULT 0,
  feedback        text,
  -- Generated content (filled by pipeline)
  post_id         uuid REFERENCES posts(id) ON DELETE SET NULL,
  caption_ig      text,
  caption_fb      text,
  hashtags        jsonb,
  image_url       text,
  video_url       text,
  quality_score   numeric,
  qc_feedback     jsonb,
  -- Metadata
  strategy_notes  text,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX proposals_brand_week_idx ON proposals(brand_id, week_start);
CREATE INDEX proposals_status_idx ON proposals(status);

ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Brand owner" ON proposals FOR ALL USING (
  brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid())
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- pg_cron scheduling (run in Supabase SQL editor with superuser)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Content Strategist: every Monday 03:00 UTC
-- SELECT cron.schedule('agent-strategist', '0 3 * * 1',
--   $$SELECT net.http_post(url:='https://<project>.supabase.co/functions/v1/agent-strategist', body:='{}', headers:='{"Authorization": "Bearer <service_role_key>"}')$$);

-- Copywriter: every 5 minutes
-- SELECT cron.schedule('agent-copywriter', '*/5 * * * *',
--   $$SELECT net.http_post(url:='https://<project>.supabase.co/functions/v1/agent-copywriter', body:='{}', headers:='{"Authorization": "Bearer <service_role_key>"}')$$);

-- Visual Generator: every 3 minutes
-- SELECT cron.schedule('agent-visual-generator', '*/3 * * * *',
--   $$SELECT net.http_post(url:='https://<project>.supabase.co/functions/v1/agent-visual-generator', body:='{}', headers:='{"Authorization": "Bearer <service_role_key>"}')$$);

-- Quality Control: every 3 minutes
-- SELECT cron.schedule('agent-quality-control', '*/3 * * * *',
--   $$SELECT net.http_post(url:='https://<project>.supabase.co/functions/v1/agent-quality-control', body:='{}', headers:='{"Authorization": "Bearer <service_role_key>"}')$$);

-- Community Manager: every 2 minutes
-- SELECT cron.schedule('agent-community-manager', '*/2 * * * *',
--   $$SELECT net.http_post(url:='https://<project>.supabase.co/functions/v1/agent-community-manager', body:='{}', headers:='{"Authorization": "Bearer <service_role_key>"}')$$);

-- Analytics: 1st of each month 06:00 UTC
-- SELECT cron.schedule('agent-analytics', '0 6 1 * *',
--   $$SELECT net.http_post(url:='https://<project>.supabase.co/functions/v1/agent-analytics', body:='{}', headers:='{"Authorization": "Bearer <service_role_key>"}')$$);

-- Health: every 15 minutes
-- SELECT cron.schedule('agent-health', '*/15 * * * *',
--   $$SELECT net.http_post(url:='https://<project>.supabase.co/functions/v1/agent-health', body:='{}', headers:='{"Authorization": "Bearer <service_role_key>"}')$$);

-- Token Renovator: every 12 hours
-- SELECT cron.schedule('agent-token-renovator', '0 */12 * * *',
--   $$SELECT net.http_post(url:='https://<project>.supabase.co/functions/v1/agent-token-renovator', body:='{}', headers:='{"Authorization": "Bearer <service_role_key>"}')$$);
