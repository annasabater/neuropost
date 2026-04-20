-- =============================================================================
-- Atomic regeneration counter — reserve/release pattern
-- =============================================================================
-- Replaces the read-then-write flow (checkRegenerationLimit +
-- incrementRegenerationCount) that was racy when a client fired two
-- regenerates back-to-back: both reads saw the same count, both writes
-- consumed a slot.
--
-- Usage from the API layer:
--   1. Call increment_regeneration_if_available(id, limit).
--      Returns a row only when regeneration_count was < limit AND the
--      UPDATE succeeded. No row == quota exhausted → respond 429.
--   2. If Replicate rejects the prediction afterwards, call
--      decrement_regeneration_count(id) to refund the slot.

CREATE OR REPLACE FUNCTION public.increment_regeneration_if_available(
  p_recreation_id uuid,
  p_limit         int
) RETURNS TABLE (new_count int, allowed boolean)
LANGUAGE sql
AS $$
  UPDATE public.recreation_requests
  SET    regeneration_count = regeneration_count + 1
  WHERE  id = p_recreation_id
    AND  regeneration_count < p_limit
  RETURNING regeneration_count, true;
$$;

CREATE OR REPLACE FUNCTION public.decrement_regeneration_count(
  p_recreation_id uuid
) RETURNS int
LANGUAGE sql
AS $$
  UPDATE public.recreation_requests
  SET    regeneration_count = GREATEST(regeneration_count - 1, 0)
  WHERE  id = p_recreation_id
  RETURNING regeneration_count;
$$;

-- Functions run with the caller's privileges. Only the service role (used
-- by API routes via createAdminClient) should invoke them; RLS on
-- recreation_requests still guards direct client-side access.
