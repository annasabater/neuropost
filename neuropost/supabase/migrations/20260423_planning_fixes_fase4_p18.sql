-- =============================================================================
-- Fase 4.C — P18: confirm_weekly_plan_atomic RPC
-- =============================================================================
-- Atomically transitions a weekly plan from client_reviewing → client_approved
-- and stamps client_approved_at in a single statement, eliminating the TOCTOU
-- window between the two separate calls in the old confirm route.
--
-- Returns JSONB:
--   { "ok": true,  "plan_id": "...", "brand_id": "..." }
--   { "ok": false, "error": "...", "actual_status": "..." }  -- on conflict
-- =============================================================================

CREATE OR REPLACE FUNCTION confirm_weekly_plan_atomic(p_plan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan weekly_plans%ROWTYPE;
BEGIN
  -- Lock the row to prevent concurrent confirmations
  SELECT * INTO v_plan FROM weekly_plans WHERE id = p_plan_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Plan not found');
  END IF;

  IF v_plan.status <> 'client_reviewing' THEN
    RETURN jsonb_build_object(
      'ok',            false,
      'error',         'Plan is not in client_reviewing state',
      'actual_status', v_plan.status
    );
  END IF;

  UPDATE weekly_plans
    SET status             = 'client_approved',
        client_approved_at = NOW(),
        updated_at         = NOW()
    WHERE id = p_plan_id;

  RETURN jsonb_build_object('ok', true, 'plan_id', p_plan_id, 'brand_id', v_plan.brand_id);
END;
$$;
