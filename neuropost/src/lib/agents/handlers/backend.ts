// =============================================================================
// F2 — Handlers for the @neuropost/agents backend package
// =============================================================================
// Wraps the 7 run* functions exported from ../../backend/index.ts as queue
// handlers. Existing route files under /api/agents/* keep working unchanged;
// this module only adds the async (queued) path.
//
// Contract for every handler: the job.input is passed straight through to
// the run* function. Agents already validate their own input shape, so we
// don't duplicate that here — any shape error bubbles up as a 'fail' result
// via toHandlerResult.

import {
  runEditorAgent,
  runCopywriterAgent,
  runIdeasAgent,
  runPlannerAgent,
  runCommunityAgent,
  runAnalystAgent,
  runPublisherAgent,
} from '@neuropost/agents';
import type {
  EditorInput,
  CopywriterInput,
  IdeasInput,
  PlannerInput,
  CommunityInput,
  AnalystInput,
  PublisherInput,
} from '@neuropost/agents';

import { registerHandler } from '../registry';
import { loadBrandContext, requireBrandId, toHandlerResult } from '../helpers';
import type { AgentHandler } from '../types';

// -----------------------------------------------------------------------------
// content:plan_edit → EditorAgent (analyzes image, returns editing plan)
// -----------------------------------------------------------------------------
const editHandler: AgentHandler = async (job) => {
  const guard = requireBrandId(job);
  if (typeof guard !== 'string') return guard;
  try {
    const { ctx } = await loadBrandContext(guard);
    const result = await runEditorAgent(job.input as unknown as EditorInput, ctx);
    return toHandlerResult('image', result, { model: 'editor-agent' });
  } catch (err) {
    return { type: 'fail', error: err instanceof Error ? err.message : String(err) };
  }
};

// -----------------------------------------------------------------------------
// content:generate_caption → CopywriterAgent
// -----------------------------------------------------------------------------
const copywriterHandler: AgentHandler = async (job) => {
  const guard = requireBrandId(job);
  if (typeof guard !== 'string') return guard;
  try {
    const { ctx } = await loadBrandContext(guard);
    const input = job.input as unknown as CopywriterInput & { _post_id?: string; _auto_pipeline?: boolean };
    const result = await runCopywriterAgent(input, ctx);
    const handlerResult = toHandlerResult('caption', result, { model: 'copywriter-agent' });

    // Auto-pipeline: save caption to post and notify client
    if (handlerResult.type === 'ok' && input._auto_pipeline && input._post_id && result.success && result.data) {
      try {
        const { createAdminClient } = await import('@/lib/supabase');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = createAdminClient() as any;

        const copies = result.data.copies;
        const platform = Object.keys(copies)[0] ?? 'instagram';
        const copy = copies[platform as keyof typeof copies];
        const hashtags = [
          ...(result.data.hashtags.branded ?? []),
          ...(result.data.hashtags.niche   ?? []),
          ...(result.data.hashtags.broad   ?? []).slice(0, 3),
        ];

        await db.from('posts').update({
          caption:  copy?.caption  ?? null,
          hashtags: hashtags.length ? hashtags : [],
          status:   'pending',
        }).eq('id', input._post_id);

        await db.from('notifications').insert({
          brand_id: job.brand_id,
          type:     'approval_needed',
          message:  'Tu contenido está listo para revisar',
          read:     false,
          metadata: { post_id: input._post_id },
        });
      } catch (e) {
        console.error('[copywriterHandler] auto-pipeline finalize error', e);
      }
    }

    return handlerResult;
  } catch (err) {
    return { type: 'fail', error: err instanceof Error ? err.message : String(err) };
  }
};

// -----------------------------------------------------------------------------
// content:generate_ideas → IdeasAgent
// -----------------------------------------------------------------------------
const ideasHandler: AgentHandler = async (job) => {
  const guard = requireBrandId(job);
  if (typeof guard !== 'string') return guard;
  try {
    const { ctx } = await loadBrandContext(guard);
    const result = await runIdeasAgent(job.input as unknown as IdeasInput, ctx);
    return toHandlerResult('strategy', result, { model: 'ideas-agent' });
  } catch (err) {
    return { type: 'fail', error: err instanceof Error ? err.message : String(err) };
  }
};

// -----------------------------------------------------------------------------
// scheduling:plan_calendar → PlannerAgent
// -----------------------------------------------------------------------------
const plannerHandler: AgentHandler = async (job) => {
  const guard = requireBrandId(job);
  if (typeof guard !== 'string') return guard;
  try {
    const { ctx } = await loadBrandContext(guard);
    const result = await runPlannerAgent(job.input as unknown as PlannerInput, ctx);
    return toHandlerResult('schedule', result, { model: 'planner-agent' });
  } catch (err) {
    return { type: 'fail', error: err instanceof Error ? err.message : String(err) };
  }
};

// -----------------------------------------------------------------------------
// support:handle_interactions → CommunityAgent
// -----------------------------------------------------------------------------
const communityHandler: AgentHandler = async (job) => {
  const guard = requireBrandId(job);
  if (typeof guard !== 'string') return guard;
  try {
    const { ctx } = await loadBrandContext(guard);
    const result = await runCommunityAgent(job.input as unknown as CommunityInput, ctx);
    return toHandlerResult('reply', result, { model: 'community-agent' });
  } catch (err) {
    return { type: 'fail', error: err instanceof Error ? err.message : String(err) };
  }
};

// -----------------------------------------------------------------------------
// analytics:analyze_performance → AnalystAgent
// -----------------------------------------------------------------------------
const analystHandler: AgentHandler = async (job) => {
  const guard = requireBrandId(job);
  if (typeof guard !== 'string') return guard;
  try {
    const { ctx } = await loadBrandContext(guard);
    const result = await runAnalystAgent(job.input as unknown as AnalystInput, ctx);
    return toHandlerResult('analysis', result, { model: 'analyst-agent' });
  } catch (err) {
    return { type: 'fail', error: err instanceof Error ? err.message : String(err) };
  }
};

// -----------------------------------------------------------------------------
// moderation:check_brand_safety → PublisherAgent
// -----------------------------------------------------------------------------
const publisherHandler: AgentHandler = async (job) => {
  const guard = requireBrandId(job);
  if (typeof guard !== 'string') return guard;
  try {
    const { ctx } = await loadBrandContext(guard);
    const result = await runPublisherAgent(job.input as unknown as PublisherInput, ctx);

    // Publisher is the only one where "success" can still mean "don't publish".
    // When safety fails, return needs_review so a worker intervenes.
    if (result.success && result.data) {
      const safety = (result.data as unknown as { brandSafetyCheck?: { passed?: boolean } }).brandSafetyCheck;
      if (safety && safety.passed === false) {
        return {
          type: 'needs_review',
          reason: 'Brand safety check failed',
          outputs: [{
            kind: 'analysis',
            payload: result.data as unknown as Record<string, unknown>,
            model: 'publisher-agent',
          }],
        };
      }
    }
    return toHandlerResult('analysis', result, { model: 'publisher-agent' });
  } catch (err) {
    return { type: 'fail', error: err instanceof Error ? err.message : String(err) };
  }
};

// -----------------------------------------------------------------------------
// Register all backend-package handlers
// -----------------------------------------------------------------------------
export function registerBackendAgentHandlers(): void {
  registerHandler({ agent_type: 'content',    action: 'plan_edit'            }, editHandler);
  registerHandler({ agent_type: 'content',    action: 'generate_caption'     }, copywriterHandler);
  registerHandler({ agent_type: 'content',    action: 'generate_ideas'       }, ideasHandler);
  registerHandler({ agent_type: 'scheduling', action: 'plan_calendar'        }, plannerHandler);
  registerHandler({ agent_type: 'support',    action: 'handle_interactions'  }, communityHandler);
  registerHandler({ agent_type: 'analytics',  action: 'analyze_performance'  }, analystHandler);
  registerHandler({ agent_type: 'moderation', action: 'check_brand_safety'   }, publisherHandler);
}
