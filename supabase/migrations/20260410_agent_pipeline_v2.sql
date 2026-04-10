-- ═══════════════════════════════════════════════════════════════════════════════
-- Agent Pipeline V2 — Tablas nuevas + extensiones
-- Solo crea lo que NO existe. No toca tablas existentes.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── generation_jobs: cola async de generación de imágenes/vídeo ──────────────

CREATE TABLE IF NOT EXISTS generation_jobs (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id         uuid REFERENCES posts(id) ON DELETE CASCADE,
  proposal_id     uuid,  -- referencia a proposals si viene del pipeline
  brand_id        uuid REFERENCES brands(id) ON DELETE CASCADE NOT NULL,
  job_type        text NOT NULL DEFAULT 'image',  -- image | video | caption
  api_provider    text NOT NULL DEFAULT 'nanobanana', -- nanobanana | replicate | leonardo | ideogram | runway
  external_job_id text,  -- ID del job en la API externa
  status          text NOT NULL DEFAULT 'pending', -- pending | submitted | processing | completed | failed
  prompt          text,
  negative_prompt text,
  parameters      jsonb DEFAULT '{}',
  result_urls     text[] DEFAULT '{}',
  storage_paths   text[] DEFAULT '{}',
  error_message   text,
  retry_count     integer DEFAULT 0,
  cost_usd        decimal(10,4),
  submitted_at    timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_status ON generation_jobs(status) WHERE status IN ('pending','submitted','processing');
CREATE INDEX IF NOT EXISTS idx_generation_jobs_external ON generation_jobs(external_job_id);

-- ── analytics_reports: informes mensuales generados por el agente ─────────────

CREATE TABLE IF NOT EXISTS analytics_reports (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id         uuid REFERENCES brands(id) ON DELETE CASCADE NOT NULL,
  month            integer NOT NULL,
  year             integer NOT NULL,
  report           jsonb NOT NULL DEFAULT '{}',
  scores           jsonb DEFAULT '{}',
  executive_summary text,
  created_at       timestamptz DEFAULT now(),
  UNIQUE(brand_id, month, year)
);

ALTER TABLE analytics_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Brand owner reads reports" ON analytics_reports
  FOR SELECT USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

-- ── community_digests: resúmenes periódicos de comunidad ─────────────────────

CREATE TABLE IF NOT EXISTS community_digests (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id            uuid REFERENCES brands(id) ON DELETE CASCADE NOT NULL,
  period_start        timestamptz NOT NULL,
  period_end          timestamptz NOT NULL,
  total_interactions  integer DEFAULT 0,
  auto_responded      integer DEFAULT 0,
  escalated           integer DEFAULT 0,
  ignored             integer DEFAULT 0,
  sentiment_breakdown jsonb DEFAULT '{}',
  category_breakdown  jsonb DEFAULT '{}',
  urgent_pending      integer DEFAULT 0,
  community_health    text, -- excelente | buena | normal | preocupante | critica
  summary             text,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE community_digests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Brand owner reads digests" ON community_digests
  FOR SELECT USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

-- ── plan_usage: tracking de uso del plan por periodo ─────────────────────────

CREATE TABLE IF NOT EXISTS plan_usage (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id              uuid REFERENCES brands(id) ON DELETE CASCADE NOT NULL,
  period_start          date NOT NULL,
  period_end            date NOT NULL,
  auto_proposals_used   integer DEFAULT 0,
  requests_used         integer DEFAULT 0,
  self_service_used     integer DEFAULT 0,
  photos_published      integer DEFAULT 0,
  videos_published      integer DEFAULT 0,
  stories_published     integer DEFAULT 0,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  UNIQUE(brand_id, period_start)
);

ALTER TABLE plan_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Brand owner reads usage" ON plan_usage
  FOR SELECT USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

-- ── system_health: registro de checks de salud ──────────────────────────────

CREATE TABLE IF NOT EXISTS system_health (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  check_type  text NOT NULL,
  status      text NOT NULL DEFAULT 'ok', -- ok | warning | critical
  details     jsonb DEFAULT '{}',
  resolved    boolean DEFAULT false,
  resolved_at timestamptz,
  created_at  timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Extensiones a tablas existentes (ADD COLUMN IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Añadir campos de clasificación a comments si no existen
DO $$ BEGIN
  ALTER TABLE comments ADD COLUMN IF NOT EXISTS category text;
  ALTER TABLE comments ADD COLUMN IF NOT EXISTS priority text;
  ALTER TABLE comments ADD COLUMN IF NOT EXISTS ai_reply_tone text;
  ALTER TABLE comments ADD COLUMN IF NOT EXISTS ig_comment_id text;
  ALTER TABLE comments ADD COLUMN IF NOT EXISTS classified_at timestamptz;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Añadir proposal_id a posts si no existe
DO $$ BEGIN
  ALTER TABLE posts ADD COLUMN IF NOT EXISTS proposal_id uuid;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Funciones PostgreSQL helper para agentes
-- ═══════════════════════════════════════════════════════════════════════════════

-- Obtener límites del plan
CREATE OR REPLACE FUNCTION get_plan_limits(p_plan text)
RETURNS jsonb AS $$
BEGIN
  RETURN CASE p_plan
    WHEN 'starter' THEN '{"proposals_week":3,"requests_month":2,"self_service_month":10,"photos_week":2,"videos_week":0,"stories_week":0,"carousel_max":3,"auto_publish":false,"autopilot":false,"auto_replies":false}'::jsonb
    WHEN 'pro' THEN '{"proposals_week":5,"requests_month":10,"self_service_month":50,"photos_week":3,"videos_week":2,"stories_week":3,"carousel_max":8,"auto_publish":true,"autopilot":false,"auto_replies":false}'::jsonb
    WHEN 'total' THEN '{"proposals_week":7,"requests_month":-1,"self_service_month":-1,"photos_week":7,"videos_week":7,"stories_week":7,"carousel_max":20,"auto_publish":true,"autopilot":true,"auto_replies":true}'::jsonb
    WHEN 'agency' THEN '{"proposals_week":7,"requests_month":-1,"self_service_month":-1,"photos_week":7,"videos_week":7,"stories_week":7,"carousel_max":20,"auto_publish":true,"autopilot":true,"auto_replies":true}'::jsonb
    ELSE '{"proposals_week":3,"requests_month":2,"self_service_month":10,"photos_week":2,"videos_week":0,"stories_week":0,"carousel_max":3,"auto_publish":false,"autopilot":false,"auto_replies":false}'::jsonb
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Incrementar uso del plan
CREATE OR REPLACE FUNCTION increment_plan_usage(
  p_brand_id uuid,
  p_field text,
  p_amount integer DEFAULT 1
) RETURNS void AS $$
BEGIN
  INSERT INTO plan_usage (brand_id, period_start, period_end)
  VALUES (
    p_brand_id,
    date_trunc('month', CURRENT_DATE)::date,
    (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date
  )
  ON CONFLICT (brand_id, period_start) DO NOTHING;

  EXECUTE format(
    'UPDATE plan_usage SET %I = %I + $1, updated_at = now() WHERE brand_id = $2 AND period_start = date_trunc(''month'', CURRENT_DATE)::date',
    p_field, p_field
  ) USING p_amount, p_brand_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Limpiar logs viejos (> 90 días)
CREATE OR REPLACE FUNCTION cleanup_old_agent_logs() RETURNS void AS $$
BEGIN
  DELETE FROM agent_logs WHERE created_at < now() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════════════
-- pg_cron jobs (ejecutar manualmente en Supabase SQL Editor)
-- Descomenta y ejecuta tras configurar las Edge Functions
-- ═══════════════════════════════════════════════════════════════════════════════

-- SELECT cron.schedule('agent-strategist', '0 3 * * 1', $$SELECT net.http_post(url:='<SUPABASE_URL>/functions/v1/agent-strategist', body:='{}'::jsonb, headers:='{"Authorization":"Bearer <SERVICE_KEY>","Content-Type":"application/json"}'::jsonb)$$);
-- SELECT cron.schedule('agent-copywriter', '*/5 * * * *', $$SELECT net.http_post(url:='<SUPABASE_URL>/functions/v1/agent-copywriter', body:='{}'::jsonb, headers:='{"Authorization":"Bearer <SERVICE_KEY>","Content-Type":"application/json"}'::jsonb)$$);
-- SELECT cron.schedule('agent-visual-generator', '*/3 * * * *', $$SELECT net.http_post(url:='<SUPABASE_URL>/functions/v1/agent-visual-generator', body:='{}'::jsonb, headers:='{"Authorization":"Bearer <SERVICE_KEY>","Content-Type":"application/json"}'::jsonb)$$);
-- SELECT cron.schedule('agent-quality-control', '*/3 * * * *', $$SELECT net.http_post(url:='<SUPABASE_URL>/functions/v1/agent-quality-control', body:='{}'::jsonb, headers:='{"Authorization":"Bearer <SERVICE_KEY>","Content-Type":"application/json"}'::jsonb)$$);
-- SELECT cron.schedule('agent-community-manager', '*/2 * * * *', $$SELECT net.http_post(url:='<SUPABASE_URL>/functions/v1/agent-community-manager', body:='{}'::jsonb, headers:='{"Authorization":"Bearer <SERVICE_KEY>","Content-Type":"application/json"}'::jsonb)$$);
-- SELECT cron.schedule('agent-analytics', '0 6 1 * *', $$SELECT net.http_post(url:='<SUPABASE_URL>/functions/v1/agent-analytics', body:='{}'::jsonb, headers:='{"Authorization":"Bearer <SERVICE_KEY>","Content-Type":"application/json"}'::jsonb)$$);
-- SELECT cron.schedule('agent-health', '*/15 * * * *', $$SELECT net.http_post(url:='<SUPABASE_URL>/functions/v1/agent-health', body:='{}'::jsonb, headers:='{"Authorization":"Bearer <SERVICE_KEY>","Content-Type":"application/json"}'::jsonb)$$);
-- SELECT cron.schedule('agent-token-renovator', '0 */12 * * *', $$SELECT net.http_post(url:='<SUPABASE_URL>/functions/v1/agent-token-renovator', body:='{}'::jsonb, headers:='{"Authorization":"Bearer <SERVICE_KEY>","Content-Type":"application/json"}'::jsonb)$$);
-- SELECT cron.schedule('log-cleanup', '0 4 * * 0', $$SELECT cleanup_old_agent_logs()$$);
