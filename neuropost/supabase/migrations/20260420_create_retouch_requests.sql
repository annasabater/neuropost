-- Sprint 7: retouch_requests table
-- Stores client-requested post changes after calendar_ready.

CREATE TABLE IF NOT EXISTS public.retouch_requests (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id                uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  week_id                uuid NOT NULL REFERENCES public.weekly_plans(id) ON DELETE CASCADE,
  brand_id               uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  requested_by_user_id   uuid REFERENCES auth.users(id),

  retouch_type           text NOT NULL,
  -- 'copy' | 'schedule' | 'freeform'

  original_value         jsonb,
  requested_value        jsonb,
  client_comment         text,

  status                 text NOT NULL DEFAULT 'pending',
  -- 'pending' | 'resolved' | 'rejected'

  resolved_at            timestamptz,
  resolved_by_worker_id  uuid REFERENCES public.worker_profiles(id),
  resolution_notes       text,

  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retouch_requests_post    ON public.retouch_requests(post_id);
CREATE INDEX IF NOT EXISTS idx_retouch_requests_week    ON public.retouch_requests(week_id);
CREATE INDEX IF NOT EXISTS idx_retouch_requests_pending ON public.retouch_requests(brand_id, status)
  WHERE status = 'pending';

ALTER TABLE public.retouch_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY retouch_client_select ON public.retouch_requests
  FOR SELECT USING (
    brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid())
  );

CREATE POLICY retouch_client_insert ON public.retouch_requests
  FOR INSERT WITH CHECK (
    brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid())
  );

CREATE POLICY retouch_worker_all ON public.retouch_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.worker_profiles WHERE user_id = auth.uid())
  );

-- Add client_retouched_at to posts if not already present
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS client_retouched_at timestamptz;
