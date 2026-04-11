-- Worker Notifications
-- Persistent notifications targeted at the worker team (not clients).
-- Inserted via admin client (bypasses RLS). Workers read with their session.

CREATE TABLE IF NOT EXISTS public.worker_notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type       TEXT NOT NULL,
  message    TEXT NOT NULL,
  brand_id   UUID REFERENCES public.brands(id) ON DELETE CASCADE,
  brand_name TEXT,
  read       BOOLEAN DEFAULT FALSE,
  metadata   JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.worker_notifications ENABLE ROW LEVEL SECURITY;

-- Any active worker can read all worker_notifications
CREATE POLICY "workers_can_read_notifications"
  ON public.worker_notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workers
      WHERE workers.id = auth.uid()
        AND workers.is_active = true
    )
  );

-- Any active worker can mark notifications as read
CREATE POLICY "workers_can_update_notifications"
  ON public.worker_notifications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workers
      WHERE workers.id = auth.uid()
        AND workers.is_active = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_worker_notifications_read
  ON public.worker_notifications(read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_worker_notifications_brand
  ON public.worker_notifications(brand_id);
