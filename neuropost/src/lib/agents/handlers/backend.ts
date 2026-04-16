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
  runSupportAgent,
  runCreativeExtractorAgent,
} from '@neuropost/agents';
import type {
  EditorInput,
  CopywriterInput,
  IdeasInput,
  PlannerInput,
  CommunityInput,
  AnalystInput,
  PublisherInput,
  SupportInput,
  ExtractorInput,
} from '@neuropost/agents';
import { generateEmbedding } from '@/lib/embeddings';
import { indexRecipe } from '@/lib/creative-library/repository';

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
// support:handle_interactions → CommunityAgent (IG comments / DMs only)
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
// support:resolve_ticket → SupportAgent (client tickets + chat)
// Dedicated agent that ALWAYS produces a reply with concrete NeuroPost-specific
// solutions. Used for /api/soporte and /api/chat flows.
// -----------------------------------------------------------------------------
const supportHandler: AgentHandler = async (job) => {
  const guard = requireBrandId(job);
  if (typeof guard !== 'string') return guard;
  try {
    const { ctx } = await loadBrandContext(guard);
    const result = await runSupportAgent(job.input as unknown as SupportInput, ctx);
    return toHandlerResult('reply', result, { model: 'support-agent' });
  } catch (err) {
    return { type: 'fail', error: err instanceof Error ? err.message : String(err) };
  }
};

// -----------------------------------------------------------------------------
// content:extract_creative_recipe → CreativeExtractorAgent
// Analyses a piece of viral content, persists the recipe + embedding in
// biblioteca_creativa, and returns the newly created recipe id. Does NOT
// require a brand_id (recipes are brand-agnostic) — but we accept one so
// the agent_jobs audit trail links back to whoever asked for the indexing.
// -----------------------------------------------------------------------------
const creativeExtractorHandler: AgentHandler = async (job) => {
  try {
    // A brand context isn't needed for extraction (recipes are generic)
    // but we load one if available so the shared agent base has a sane
    // AgentContext. If no brand, build a minimal synthetic context.
    const input = job.input as unknown as ExtractorInput & {
      fuente?: { url?: string; cuenta?: string; plataforma?: string };
    };
    const ctx = job.brand_id
      ? (await loadBrandContext(job.brand_id)).ctx
      : syntheticCtx();

    const result = await runCreativeExtractorAgent(input, ctx);
    if (!result.success || !result.data) {
      return { type: 'fail', error: result.error?.message ?? 'Extractor failed' };
    }

    // Generate embedding (null-tolerant; repository handles the null case).
    const embedding = await generateEmbedding(result.data.embeddingText);

    const stored = await indexRecipe({
      recipe:    result.data.recipe,
      embedding: embedding?.vector ?? null,
      fuente: input.fuente
        ? {
            url:        input.fuente.url,
            cuenta:     input.fuente.cuenta,
            plataforma: (input.fuente.plataforma as 'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'manual' | undefined) ?? 'manual',
          }
        : undefined,
      indexadoPorAgente: true,
    });

    return toHandlerResult('analysis', {
      success: true,
      data: {
        recipe_id:     stored.id,
        quality_score: stored.quality_score,
        has_embedding: stored.has_embedding,
        industry:      stored.industry_vertical,
      },
    }, { model: 'creative-extractor' });
  } catch (err) {
    return { type: 'fail', error: err instanceof Error ? err.message : String(err) };
  }
};

/** Minimal synthetic AgentContext for brand-agnostic agents. */
function syntheticCtx() {
  return {
    businessId:       'system',
    businessName:     'NeuroPost (library indexer)',
    brandVoice: {
      tone:            'profesional' as const,
      keywords:        [],
      forbiddenWords:  [],
      sector:          'otro' as const,
      language:        'en',
      exampleCaptions: [],
    },
    socialAccounts: { accessToken: '' },
    timezone:         'Europe/Madrid',
    subscriptionTier: 'pro' as const,
  };
}

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
  registerHandler({ agent_type: 'support',    action: 'handle_interactions'   }, communityHandler);
  registerHandler({ agent_type: 'support',    action: 'resolve_ticket'        }, supportHandler);
  registerHandler({ agent_type: 'analytics',  action: 'analyze_performance'   }, analystHandler);
  registerHandler({ agent_type: 'moderation', action: 'check_brand_safety'    }, publisherHandler);
  registerHandler({ agent_type: 'content',    action: 'extract_creative_recipe' }, creativeExtractorHandler);
}
