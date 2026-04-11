// =============================================================================
// Agent system — shared types
// =============================================================================
// Every job in the queue, every output, and every handler speaks this shape.

export type AgentType =
  | 'content'
  | 'strategy'
  | 'support'
  | 'analytics'
  | 'moderation'
  | 'scheduling'
  | 'growth';

export type AgentJobStatus =
  | 'pending'
  | 'running'
  | 'done'
  | 'error'
  | 'needs_review'
  | 'cancelled';

export type AgentJobRequester = 'client' | 'worker' | 'cron' | 'agent';

export interface AgentJob {
  id:             string;
  brand_id:       string | null;
  agent_type:     AgentType;
  action:         string;
  input:          Record<string, unknown>;
  status:         AgentJobStatus;
  priority:       number;
  attempts:       number;
  max_attempts:   number;
  requested_by:   AgentJobRequester | null;
  requester_id:   string | null;
  parent_job_id:  string | null;
  scheduled_for:  string | null;
  started_at:     string | null;
  finished_at:    string | null;
  error:          string | null;
  created_at:     string;
}

export type AgentOutputKind =
  | 'post'
  | 'caption'
  | 'image'
  | 'video'
  | 'reply'
  | 'strategy'
  | 'analysis'
  | 'schedule';

export interface AgentOutput {
  id:           string;
  job_id:       string;
  brand_id:     string | null;
  kind:         AgentOutputKind;
  payload:      Record<string, unknown>;
  preview_url:  string | null;
  cost_usd:     number | null;
  tokens_used:  number | null;
  model:        string | null;
  created_at:   string;
}

// =============================================================================
// Handler contract
// =============================================================================
// A handler is a pure function that takes a job and returns one of:
//   - a success result with outputs to persist (and optional sub-jobs to queue)
//   - a failure that the runner will retry (up to max_attempts)
//   - a needs_review result that parks the job for human intervention
//
// Handlers MUST NOT write to agent_jobs/agent_outputs themselves — the runner
// owns persistence. This keeps the contract simple and testable.

export interface HandlerOutput {
  kind:         AgentOutputKind;
  payload:      Record<string, unknown>;
  preview_url?: string;
  cost_usd?:    number;
  tokens_used?: number;
  model?:       string;
}

export interface HandlerSubJob {
  agent_type:    AgentType;
  action:        string;
  input:         Record<string, unknown>;
  priority?:     number;
  scheduled_for?: string;
}

export type HandlerResult =
  | { type: 'ok';            outputs?: HandlerOutput[]; sub_jobs?: HandlerSubJob[] }
  | { type: 'needs_review';  reason: string; outputs?: HandlerOutput[] }
  | { type: 'retry';         error: string }
  | { type: 'fail';          error: string };

export type AgentHandler = (job: AgentJob) => Promise<HandlerResult>;

export interface HandlerKey {
  agent_type: AgentType;
  action:     string;
}

// =============================================================================
// Queue API (public surface used by API routes and other agents)
// =============================================================================

export interface QueueJobInput {
  brand_id?:      string | null;
  agent_type:     AgentType;
  action:         string;
  input?:         Record<string, unknown>;
  priority?:      number;
  max_attempts?:  number;
  requested_by?:  AgentJobRequester;
  requester_id?:  string | null;
  parent_job_id?: string | null;
  scheduled_for?: string | null;
}
