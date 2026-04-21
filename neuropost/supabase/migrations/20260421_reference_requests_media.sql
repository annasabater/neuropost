-- Add own_media_urls to reference_requests + expand timing_preference constraint

ALTER TABLE reference_requests
  ADD COLUMN IF NOT EXISTS own_media_urls text[] DEFAULT '{}';

-- Expand timing_preference to include new values (next_week replaces asap/next_two_weeks)
ALTER TABLE reference_requests
  DROP CONSTRAINT IF EXISTS reference_requests_timing_preference_check;

ALTER TABLE reference_requests
  ADD CONSTRAINT reference_requests_timing_preference_check
  CHECK (timing_preference IN ('asap', 'next_two_weeks', 'next_week', 'specific_date', NULL));
