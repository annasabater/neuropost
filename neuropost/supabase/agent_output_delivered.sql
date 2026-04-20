-- =============================================================================
-- Migration: Add output_delivered tracking to agent_jobs
-- =============================================================================
-- Purpose: Track which agent jobs have had their outputs saved to destination
-- tables (chat_messages, support_ticket_messages, comments, etc.) to avoid
-- duplicate processing in the process-agent-replies cron.

ALTER TABLE agent_jobs ADD COLUMN IF NOT EXISTS output_delivered boolean DEFAULT false;

-- Index for efficient query of pending output processing
CREATE INDEX IF NOT EXISTS idx_agent_jobs_output_pending
  ON agent_jobs(agent_type, status, output_delivered)
  WHERE status = 'done' AND output_delivered = false;
