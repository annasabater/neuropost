-- GAP 2: Create audit_logs table (was missing from production).
-- logAudit() in src/lib/audit.ts was silently failing because this table did not exist.
-- Schema matches EXACTLY the fields inserted by logAudit().

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type    TEXT        NOT NULL,
  actor_id      UUID,
  actor_name    TEXT,
  actor_ip      TEXT,
  action        TEXT        NOT NULL,
  resource_type TEXT        NOT NULL,
  resource_id   UUID,
  resource_name TEXT,
  brand_id      UUID,
  description   TEXT        NOT NULL,
  changes       JSONB       DEFAULT NULL,
  metadata      JSONB       DEFAULT NULL,
  severity      TEXT        NOT NULL DEFAULT 'info',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_brand_id
  ON public.audit_logs(brand_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON public.audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id
  ON public.audit_logs(actor_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource
  ON public.audit_logs(resource_type, resource_id);
