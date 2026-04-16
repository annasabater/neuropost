-- =============================================================================
-- Migration: Add Replicate image generation support to recreation_requests
-- Run in Supabase SQL Editor
-- =============================================================================

-- New columns for async Replicate predictions
ALTER TABLE recreation_requests
  ADD COLUMN IF NOT EXISTS generated_images    text[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS replicate_prediction_id text,
  ADD COLUMN IF NOT EXISTS replicate_status    text;   -- 'starting' | 'processing' | 'succeeded' | 'failed'

-- Status extended: 'pending' | 'preparacion' | 'revisar' | 'completed' | 'rejected'
-- (already supports text so no ENUM change needed)

-- Index for webhook lookups by prediction_id
CREATE INDEX IF NOT EXISTS idx_recreation_requests_prediction_id
  ON recreation_requests(replicate_prediction_id)
  WHERE replicate_prediction_id IS NOT NULL;

-- Index for brand status queries
CREATE INDEX IF NOT EXISTS idx_recreation_requests_brand_status
  ON recreation_requests(brand_id, status);
