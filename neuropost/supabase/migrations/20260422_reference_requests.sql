-- =============================================================================
-- reference_requests: client-sent requests to recreate an inspiration item.
-- Decoupled from inspiration_saved — a saved item can have 0..N requests.
-- Uses source + item_id (same pattern as inspiration_saved) to support both
-- inspiration_bank (source='bank') and legacy items (source='legacy').
-- =============================================================================

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TABLE IF NOT EXISTS reference_requests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id   uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  source     text NOT NULL CHECK (source IN ('legacy', 'bank')),
  item_id    uuid NOT NULL,

  -- Client-facing status
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'scheduled', 'published', 'cancelled')),

  -- Info from the client
  client_comment      text,
  timing_preference   text CHECK (timing_preference IN ('asap', 'next_two_weeks', 'specific_date')),
  preferred_date      date,

  -- Tracking
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  scheduled_for timestamptz,
  published_at  timestamptz,
  cancelled_at  timestamptz,
  cancelled_reason text,

  -- Internal
  assigned_to    uuid,
  internal_notes text
);

CREATE INDEX IF NOT EXISTS idx_rr_brand_status ON reference_requests(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_rr_item        ON reference_requests(source, item_id);

ALTER TABLE reference_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rr_select_own" ON reference_requests
  FOR SELECT TO authenticated
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

CREATE POLICY "rr_insert_own" ON reference_requests
  FOR INSERT TO authenticated
  WITH CHECK (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

CREATE POLICY "rr_update_own" ON reference_requests
  FOR UPDATE TO authenticated
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

CREATE TRIGGER trg_rr_updated_at
  BEFORE UPDATE ON reference_requests
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
