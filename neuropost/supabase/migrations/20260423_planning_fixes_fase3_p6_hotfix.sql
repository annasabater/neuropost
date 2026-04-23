-- =============================================================================
-- Planning Fixes Fase 3 — P6 hotfix: cast day_of_week text → int
-- =============================================================================
-- create_weekly_plan_atomic extracted day_of_week via ->> (returns text) but
-- content_ideas.day_of_week is integer. Explicit ::int cast added.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_weekly_plan_atomic(
  p_brand_id         uuid,
  p_week_start       date,
  p_parent_job_id    uuid,
  p_agent_output_id  uuid,
  p_ideas            jsonb
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

  SELECT * INTO v_plan
  FROM weekly_plans
  WHERE brand_id = p_brand_id AND week_start = p_week_start;

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
      (idea->>'day_of_week')::int,
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

REVOKE ALL ON FUNCTION public.create_weekly_plan_atomic(uuid, date, uuid, uuid, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_weekly_plan_atomic(uuid, date, uuid, uuid, jsonb) TO service_role;
