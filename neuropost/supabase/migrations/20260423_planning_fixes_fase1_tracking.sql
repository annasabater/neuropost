-- =============================================================================
-- Planning fixes Fase 1: tracking columns for renders, notifications, emails
-- =============================================================================
-- Adds observable state to content_ideas (render pipeline) and weekly_plans
-- (worker notification + client email delivery). Enables the cron reconcilers
-- in Fase 2 to detect and recover stuck operations.
-- =============================================================================

BEGIN;

-- ─── 1. content_ideas: render tracking ──────────────────────────────────────

ALTER TABLE public.content_ideas
  ADD COLUMN IF NOT EXISTS render_status       text,
  ADD COLUMN IF NOT EXISTS render_attempts     int         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS render_started_at   timestamptz,
  ADD COLUMN IF NOT EXISTS render_completed_at timestamptz;

ALTER TABLE public.content_ideas
  DROP CONSTRAINT IF EXISTS content_ideas_render_status_check;

ALTER TABLE public.content_ideas
  ADD CONSTRAINT content_ideas_render_status_check
    CHECK (render_status IS NULL OR render_status IN (
      'pending_render', 'rendering', 'rendered', 'render_failed', 'not_applicable'
    ));

-- Index used by reconcile-renders cron to find stuck/pending stories efficiently
CREATE INDEX IF NOT EXISTS idx_content_ideas_render_pending
  ON public.content_ideas (render_status, render_started_at)
  WHERE render_status IN ('pending_render', 'rendering');

-- ─── 2. content_ideas: backfill render_status ────────────────────────────────
-- Posts never need rendering → not_applicable
-- Stories with a rendered URL → rendered
-- Stories with a render_error → render_failed
-- Stories with neither → pending_render (the cron will retry them)

UPDATE public.content_ideas
  SET render_status = CASE
    WHEN content_kind = 'post'                  THEN 'not_applicable'
    WHEN rendered_image_url IS NOT NULL         THEN 'rendered'
    WHEN render_error       IS NOT NULL         THEN 'render_failed'
    ELSE                                             'pending_render'
  END
  WHERE render_status IS NULL;

-- ─── 3. weekly_plans: worker notification status ─────────────────────────────

ALTER TABLE public.weekly_plans
  ADD COLUMN IF NOT EXISTS worker_notify_status text;

ALTER TABLE public.weekly_plans
  DROP CONSTRAINT IF EXISTS weekly_plans_worker_notify_status_check;

ALTER TABLE public.weekly_plans
  ADD CONSTRAINT weekly_plans_worker_notify_status_check
    CHECK (worker_notify_status IS NULL OR worker_notify_status IN (
      'not_needed', 'pending', 'sent', 'failed'
    ));

-- ─── 4. weekly_plans: client email status ────────────────────────────────────

ALTER TABLE public.weekly_plans
  ADD COLUMN IF NOT EXISTS client_email_status   text,
  ADD COLUMN IF NOT EXISTS client_email_attempts int NOT NULL DEFAULT 0;

ALTER TABLE public.weekly_plans
  DROP CONSTRAINT IF EXISTS weekly_plans_client_email_status_check;

ALTER TABLE public.weekly_plans
  ADD CONSTRAINT weekly_plans_client_email_status_check
    CHECK (client_email_status IS NULL OR client_email_status IN (
      'not_needed', 'pending', 'sent', 'failed'
    ));

-- ─── 5. weekly_plans: backfill ───────────────────────────────────────────────
-- Plans that already notified a worker → sent
-- Plans that already emailed the client → sent (sent_to_client_at is the signal)
-- Plans in ideas_ready with no notification history → treat as pending
--   (the cron in Fase 2 will handle them)
-- Plans that went directly to client_reviewing without worker gate → not_needed
-- All other active plans without email → not_needed for now (conservative)

UPDATE public.weekly_plans
  SET worker_notify_status = CASE
    WHEN status IN ('ideas_ready') AND worker_notify_status IS NULL THEN 'pending'
    WHEN worker_notify_status IS NULL THEN 'not_needed'
    ELSE worker_notify_status
  END
  WHERE worker_notify_status IS NULL;

UPDATE public.weekly_plans
  SET client_email_status = CASE
    WHEN sent_to_client_at IS NOT NULL THEN 'sent'
    WHEN status IN ('client_reviewing', 'client_approved', 'producing',
                    'calendar_ready', 'completed', 'auto_approved')
      THEN 'sent'  -- reached client somehow
    ELSE 'not_needed'
  END
  WHERE client_email_status IS NULL;

-- ─── 6. unique index for worker_notifications ────────────────────────────────
-- Prevents duplicate notifications for the same plan+type if plan_week
-- is retried or called concurrently.

CREATE UNIQUE INDEX IF NOT EXISTS uq_worker_notifications_plan_type
  ON public.worker_notifications ((metadata->>'plan_id'), type)
  WHERE metadata->>'plan_id' IS NOT NULL;

COMMIT;
