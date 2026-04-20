-- =============================================================================
-- BullMQ migration — helpers for Supabase fallback path
-- =============================================================================
-- Run this in Supabase SQL Editor once before deploying the BullMQ version.
--
-- The claim_agent_jobs function is kept as a fallback for when Redis is down.
-- This adds a covering index so the fallback path remains fast.

-- Index for the BullMQ fallback path (status=pending, respect scheduled_for)
CREATE INDEX IF NOT EXISTS idx_agent_jobs_pending_scheduled
  ON agent_jobs (status, priority DESC, scheduled_for ASC NULLS FIRST)
  WHERE status = 'pending';

-- output_delivered column (used by process-agent-replies cron for deduplication)
ALTER TABLE agent_jobs ADD COLUMN IF NOT EXISTS output_delivered boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_agent_jobs_output_pending
  ON agent_jobs (agent_type, status, output_delivered)
  WHERE status = 'done' AND output_delivered = false;
