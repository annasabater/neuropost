-- =============================================================================
-- Planning Fixes Fase 3 — P6: atomic plan creation
-- =============================================================================
-- 1. UNIQUE INDEX on weekly_plans(brand_id, week_start) — enforces one plan
--    per brand per week at DB level.
-- 2. create_weekly_plan_atomic RPC — wraps INSERT weekly_plans +
--    INSERT content_ideas in a real transaction. Replaces the manual
--    DELETE rollback pattern in weekly-plan-service.ts.
--    Returns jsonb: { plan, ideas, created }.
-- =============================================================================

-- ─── 1. Unique index ──────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS uq_weekly_plans_brand_week
  ON public.weekly_plans (brand_id, week_start);

-- ─── 2. Atomic RPC ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_weekly_plan_atomic(
  p_brand_id         uuid,
  p_week_start       date,
  p_parent_job_id    uuid,
  p_agent_output_id  uuid,
  p_ideas            jsonb   -- json array of ParsedIdea objects
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan       weekly_plans%ROWTYPE;
  v_ideas_json jsonb := '[]'::jsonb;
  v_created    boolean;
  v_rows       int;
BEGIN
  -- Idempotent INSERT: if (brand_id, week_start) already exists the unique
  -- index causes ON CONFLICT DO NOTHING — 0 rows affected, no error.
  INSERT INTO weekly_plans (
    brand_id, parent_job_id, week_start,
    status, auto_approved, auto_approved_at
  )
  VALUES (
    p_brand_id, p_parent_job_id, p_week_start,
    'generating', false, null
  )
  ON CONFLICT (brand_id, week_start) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_created := (v_rows = 1);

  -- Fetch the canonical plan row (whether just inserted or pre-existing).
  SELECT * INTO v_plan
  FROM weekly_plans
  WHERE brand_id = p_brand_id AND week_start = p_week_start;

  -- Only insert ideas on fresh creation — never overwrite existing ideas.
  IF v_created AND p_ideas IS NOT NULL AND jsonb_array_length(p_ideas) > 0 THEN
    INSERT INTO content_ideas (
      week_id,
      brand_id,
      agent_output_id,
      category_id,
      position,
      day_of_week,
      format,
      angle,
      hook,
      copy_draft,
      hashtags,
      suggested_asset_url,
      suggested_asset_id,
      status
    )
    SELECT
      v_plan.id,
      p_brand_id,
      p_agent_output_id,
      NULLIF(idea->>'category_id', '')::uuid,
      (idea->>'position')::int,
      idea->>'day_of_week',
      idea->>'format',
      idea->>'angle',
      idea->>'hook',
      idea->>'copy_draft',
      ARRAY(
        SELECT value
        FROM jsonb_array_elements_text(COALESCE(idea->'hashtags', '[]'::jsonb))
      ),
      NULLIF(idea->>'suggested_asset_url', ''),
      NULLIF(idea->>'suggested_asset_id', '')::uuid,
      'pending'
    FROM jsonb_array_elements(p_ideas) AS idea;
  END IF;

  -- Fetch back ideas for the return payload.
  SELECT COALESCE(jsonb_agg(row_to_json(ci) ORDER BY ci.position), '[]'::jsonb)
  INTO v_ideas_json
  FROM content_ideas ci
  WHERE ci.week_id = v_plan.id;

  RETURN jsonb_build_object(
    'plan',    row_to_json(v_plan),
    'ideas',   v_ideas_json,
    'created', v_created
  );
END;
$$;

-- Restrict to service_role only — never called from browser.
REVOKE ALL ON FUNCTION public.create_weekly_plan_atomic(uuid, date, uuid, uuid, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_weekly_plan_atomic(uuid, date, uuid, uuid, jsonb) TO service_role;
