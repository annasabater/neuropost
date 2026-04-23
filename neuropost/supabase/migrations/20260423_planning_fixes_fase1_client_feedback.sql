-- =============================================================================
-- Planning fixes Fase 1: client_feedback table + use_new_planning_flow column
-- =============================================================================
-- client_feedback was referenced in code but never created as a DB table.
-- All client audit actions (approve/edit/request_variation/reject) were
-- silently discarded. This migration creates the table and enables RLS.
--
-- use_new_planning_flow: the column is referenced in src/types/index.ts and
-- src/lib/agents/strategy/plan-week.ts but has no SQL migration. Added here
-- with DEFAULT false (opt-in, backwards-compatible).
-- =============================================================================

BEGIN;

-- ─── 1. client_feedback ───────────────────────────────────────────────────────
-- Schema inferred from src/app/api/client/weekly-plans/[id]/ideas/[ideaId]/route.ts:95-105

CREATE TABLE IF NOT EXISTS public.client_feedback (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id        uuid        NOT NULL REFERENCES public.weekly_plans(id) ON DELETE CASCADE,
  idea_id        uuid        NOT NULL REFERENCES public.content_ideas(id) ON DELETE CASCADE,
  brand_id       uuid        NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  action         text        NOT NULL,
  comment        text,
  previous_value jsonb,
  new_value      jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT client_feedback_action_check
    CHECK (action IN ('approve', 'edit', 'request_variation', 'reject'))
);

COMMENT ON TABLE public.client_feedback IS
  'Audit trail of all client actions on content ideas. One row per action.
   previous_value / new_value carry snapshots of the fields that changed.';

CREATE INDEX IF NOT EXISTS idx_client_feedback_idea
  ON public.client_feedback (idea_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_feedback_week
  ON public.client_feedback (week_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_feedback_brand
  ON public.client_feedback (brand_id, created_at DESC);

ALTER TABLE public.client_feedback ENABLE ROW LEVEL SECURITY;

-- Brand owners can INSERT and SELECT their own feedback
DROP POLICY IF EXISTS client_feedback_brand_owner ON public.client_feedback;
CREATE POLICY client_feedback_brand_owner ON public.client_feedback
  FOR ALL
  USING (
    brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid())
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid())
    OR auth.role() = 'service_role'
  );

-- Workers can read all client feedback (for review context)
DROP POLICY IF EXISTS client_feedback_worker_read ON public.client_feedback;
CREATE POLICY client_feedback_worker_read ON public.client_feedback
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workers
      WHERE workers.id = auth.uid() AND workers.is_active = true
    )
  );

-- ─── 2. use_new_planning_flow on brands ──────────────────────────────────────
-- Opt-in flag. DEFAULT false = legacy flow (fan-out sub_jobs) for all existing
-- brands. Set to true per-brand to enable Sprint 10+ planning pipeline.

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS use_new_planning_flow boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.brands.use_new_planning_flow IS
  'When true, plan_week uses the Sprint 10+ weekly_plans + content_ideas pipeline
   with client review flow. When false (default), uses legacy fan-out sub_jobs.';

COMMIT;
