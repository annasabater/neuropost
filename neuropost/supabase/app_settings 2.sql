-- ═══════════════════════════════════════════════════════════════════════════
-- app_settings — global singleton settings for the worker portal
-- ═══════════════════════════════════════════════════════════════════════════
-- Key-value config accessed by the backend. RLS off: the service-role
-- client (createAdminClient) bypasses RLS and the gate is enforced in
-- Next API routes via requireWorker / requireAdminOrSenior.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.app_settings (
  key        TEXT        PRIMARY KEY,
  value      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID        REFERENCES public.workers(id) ON DELETE SET NULL
);

-- Seed: conservative defaults (everything reviewed).
INSERT INTO public.app_settings (key, value)
VALUES (
  'human_review_defaults',
  '{"messages":true,"images":true,"videos":true,"requests":true}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
