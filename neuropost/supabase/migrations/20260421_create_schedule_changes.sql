-- Dropear la tabla con schema antiguo (sin riesgo, nadie la usa)
DROP TABLE IF EXISTS public.schedule_changes CASCADE;

-- Recrear con el schema correcto del Sprint 8
CREATE TABLE public.schedule_changes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id              uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  week_id              uuid REFERENCES public.weekly_plans(id) ON DELETE SET NULL,
  brand_id             uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  changed_by_user_id   uuid REFERENCES auth.users(id),
  changed_by_role      text NOT NULL,
  old_scheduled_at     timestamptz,
  new_scheduled_at     timestamptz NOT NULL,
  change_reason        text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_schedule_changes_post         ON public.schedule_changes(post_id);
CREATE INDEX idx_schedule_changes_week         ON public.schedule_changes(week_id);
CREATE INDEX idx_schedule_changes_brand_recent ON public.schedule_changes(brand_id, created_at DESC);

ALTER TABLE public.schedule_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY schedule_changes_client_select ON public.schedule_changes
  FOR SELECT USING (
    brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid())
    OR auth.role() = 'service_role'
  );

CREATE POLICY schedule_changes_worker_all ON public.schedule_changes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.workers WHERE id = auth.uid() AND is_active = true)
    OR auth.role() = 'service_role'
  );

-- Verificación
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'schedule_changes'
ORDER BY ordinal_position;

SELECT policyname, cmd FROM pg_policies WHERE tablename = 'schedule_changes';