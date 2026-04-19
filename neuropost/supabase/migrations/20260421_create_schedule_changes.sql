-- Sprint 8: schedule_changes audit table
-- Records every reschedule action on posts for full auditability.

CREATE TABLE IF NOT EXISTS public.schedule_changes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id              uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  week_id              uuid REFERENCES public.weekly_plans(id) ON DELETE SET NULL,
  brand_id             uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,

  changed_by_user_id   uuid REFERENCES auth.users(id),
  changed_by_role      text NOT NULL,
  -- 'client' | 'worker'

  old_scheduled_at     timestamptz,
  new_scheduled_at     timestamptz NOT NULL,

  change_reason        text,

  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_changes_post        ON public.schedule_changes(post_id);
CREATE INDEX IF NOT EXISTS idx_schedule_changes_week        ON public.schedule_changes(week_id);
CREATE INDEX IF NOT EXISTS idx_schedule_changes_brand_recent ON public.schedule_changes(brand_id, created_at DESC);

ALTER TABLE public.schedule_changes ENABLE ROW LEVEL SECURITY;

-- Cliente ve los cambios de sus marcas
CREATE POLICY schedule_changes_client_select ON public.schedule_changes
  FOR SELECT USING (
    brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid())
    OR auth.role() = 'service_role'
  );

-- Worker ve y gestiona todo
CREATE POLICY schedule_changes_worker_all ON public.schedule_changes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.worker_profiles WHERE user_id = auth.uid())
    OR auth.role() = 'service_role'
  );
