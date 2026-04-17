-- ═══════════════════════════════════════════════════════════════════════════════
-- Finance dashboard, audit logs, and app settings
-- 2026-04-17
-- NOTE: provider_costs is created in 20260417_worker_observability.sql
--       Run that migration first, or run this one standalone (index added safely below)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Monthly metrics snapshots (for finance charts) ───────────────────────────
CREATE TABLE IF NOT EXISTS monthly_metrics_snapshot (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month           date NOT NULL,
  plan            text NOT NULL,
  client_count    integer NOT NULL DEFAULT 0,
  mrr             numeric(10,2) NOT NULL DEFAULT 0,
  new_clients     integer DEFAULT 0,
  churned_clients integer DEFAULT 0,
  revenue         numeric(10,2) DEFAULT 0,
  expenses        numeric(10,2) DEFAULT 0,
  cash_balance    numeric(10,2) DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(month, plan)
);

CREATE INDEX IF NOT EXISTS idx_monthly_snapshot_month ON monthly_metrics_snapshot(month);

-- ── Fixed costs (configurable by admin) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS fixed_costs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category    text NOT NULL,            -- 'nominas' | 'infraestructura' | 'marketing' | 'herramientas' | 'stripe_fees' | 'otros'
  name        text NOT NULL,
  amount_eur  numeric(10,2) NOT NULL,
  currency    text DEFAULT 'EUR',
  is_monthly  boolean DEFAULT true,
  active      boolean DEFAULT true,
  notes       text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fixed_costs_active ON fixed_costs(active) WHERE active = true;

-- Seed example fixed costs
INSERT INTO fixed_costs (category, name, amount_eur) VALUES
  ('infraestructura', 'Supabase Pro', 25),
  ('infraestructura', 'Vercel Pro', 20),
  ('infraestructura', 'Dominio + SSL', 15),
  ('marketing', 'Instagram Ads', 200)
ON CONFLICT DO NOTHING;

-- ── App settings (key-value store) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO app_settings (key, value) VALUES
  ('usd_to_eur', '"0.92"'),
  ('initial_cash_balance', '"0"'),
  ('churn_target_pct', '"2.0"'),
  ('ai_cost_alert_threshold_pct', '"15"')
ON CONFLICT (key) DO NOTHING;

-- ── Audit logs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type     text NOT NULL,         -- 'user' | 'worker' | 'agent' | 'system' | 'stripe_webhook' | 'cron'
  actor_id       uuid,
  actor_name     text,
  actor_ip       inet,
  action         text NOT NULL,         -- 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'claim' | 'publish' | 'login' | 'subscribe' | 'cancel' | 'generate' | etc.
  resource_type  text NOT NULL,         -- 'post' | 'brand' | 'special_request' | 'agent_job' | 'ticket' | 'subscription' | etc.
  resource_id    uuid,
  resource_name  text,
  brand_id       uuid REFERENCES brands(id) ON DELETE SET NULL,
  description    text NOT NULL,
  changes        jsonb,                 -- { "field": { "old": ..., "new": ... } }
  metadata       jsonb,
  severity       text DEFAULT 'info'
                 CHECK (severity IN ('info', 'warning', 'critical')),
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor         ON audit_logs(actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource      ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_brand         ON audit_logs(brand_id);
CREATE INDEX IF NOT EXISTS idx_audit_severity      ON audit_logs(severity) WHERE severity IN ('warning', 'critical');
CREATE INDEX IF NOT EXISTS idx_audit_created       ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_type_action_date ON audit_logs(resource_type, action, created_at);

-- ── provider_costs: extra index for finance queries ───────────────────────────
-- Safely add if provider_costs already exists (created in worker_observability migration)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'provider_costs' AND table_schema = 'public') THEN
    CREATE INDEX IF NOT EXISTS idx_provider_costs_brand_month ON provider_costs(brand_id, created_at);
  END IF;
END $$;
