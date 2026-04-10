-- Portal Workers - Control de acceso al portal /worker
CREATE TABLE IF NOT EXISTS public.portal_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'supervisor', 'agent')),
  is_active BOOLEAN DEFAULT true,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id) -- Un user solo puede estar una vez como worker
);

-- RLS Policies
ALTER TABLE public.portal_workers ENABLE ROW LEVEL SECURITY;

-- Only admin workers can manage portal_workers
CREATE POLICY "admin_manage_portal_workers"
  ON public.portal_workers FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.portal_workers WHERE role = 'admin' AND is_active = true
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.portal_workers WHERE role = 'admin' AND is_active = true
    )
  );

-- Any portal worker can view the list
CREATE POLICY "portal_workers_can_view"
  ON public.portal_workers FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.portal_workers WHERE is_active = true
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_portal_workers_user_id ON public.portal_workers(user_id);
CREATE INDEX IF NOT EXISTS idx_portal_workers_role ON public.portal_workers(role);
CREATE INDEX IF NOT EXISTS idx_portal_workers_active ON public.portal_workers(is_active);
