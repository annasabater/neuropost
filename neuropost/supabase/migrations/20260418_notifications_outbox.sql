-- =============================================================================
-- Outbox pattern for critical notifications
-- =============================================================================
-- Durable queue for notification dispatch. The in-app `notifications` row is
-- still written synchronously so the UI stays live; the outbox row is
-- processed by /api/cron/flush-notifications every minute to drive email /
-- downstream delivery with retry on transient failure.

CREATE TABLE IF NOT EXISTS public.notifications_outbox (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  type        text NOT NULL,
  payload     jsonb NOT NULL,
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','sent','failed')),
  retry_count integer NOT NULL DEFAULT 0,
  last_error  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  sent_at     timestamptz
);

-- Processor index: pick pending rows in insertion order
CREATE INDEX IF NOT EXISTS idx_notifications_outbox_pending
  ON public.notifications_outbox (created_at)
  WHERE status = 'pending';

-- Tail index for dashboards / audits
CREATE INDEX IF NOT EXISTS idx_notifications_outbox_brand_status
  ON public.notifications_outbox (brand_id, status, created_at DESC);

ALTER TABLE public.notifications_outbox ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; no client-facing policies needed.
