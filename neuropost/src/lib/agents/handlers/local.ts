// =============================================================================
// F2 — Handlers for the local agents under src/agents/*
// =============================================================================
// These return plain objects instead of the backend package's
// `{ success, data }` shape, so we wrap each one manually.
//
// Covered agents (11 handlers):
//   content:generate_image           → runImageGenerateAgent    (NanoBanana)
//   content:generate_video           → runVideoGenerateAgent    (RunwayML)
//   content:generate_human_photo     → runHiggsFieldAgent       (Higgsfield — foto con personas)
//   content:generate_human_video     → runHiggsFieldAgent       (Higgsfield — vídeo con personas)
//   content:apply_edit               → runImageEditAgent        (NanoBanana img2img)
//   content:seasonal_content         → generateSeasonalContent
//   content:adapt_trend              → adaptTrendToBrand
//   content:analyze_inspiration      → analyzeReference         (style analysis)
//   analytics:detect_trends          → detectTrendsBySector
//   analytics:analyze_competitor     → analyzeCompetitor
//   growth:retention_email           → generateRetentionEmail

import { runImageGenerateAgent, type ImageGenerateInput } from '@/agents/ImageGenerateAgent';
import { runVideoGenerateAgent, type VideoGenerateInput } from '@/agents/VideoGenerateAgent';
import { runHiggsFieldAgent,    type HiggsFieldInput    } from '@/agents/HiggsFieldAgent';
import { runImageEditAgent,     type ImageEditInput     } from '@/agents/ImageEditAgent';
import {
  detectTrendsBySector,
  adaptTrendToBrand,
  type TrendsAdaptInput,
} from '@/agents/TrendsAgent';
import { analyzeCompetitor } from '@/agents/CompetitorAgent';
import { generateSeasonalContent } from '@/agents/SeasonalAgent';
import { analyzeReference, type AnalyzeReferenceInput } from '@/agents/InspirationAgent';
import { generateRetentionEmail } from '@/agents/ChurnAgent';

import { registerHandler } from '../registry';
import { requireBrandId } from '../helpers';
import type { AgentHandler, HandlerResult } from '../types';

/**
 * Shared wrapper: runs a plain-return agent function and maps thrown errors
 * to retry (transient) or fail (permanent) per the same heuristic used in
 * helpers.toHandlerResult.
 */
async function runPlain<T>(
  fn:   () => Promise<T>,
  kind: 'post' | 'caption' | 'image' | 'video' | 'reply' | 'strategy' | 'analysis' | 'schedule',
  opts: { model?: string; preview_url?: (out: T) => string | undefined } = {},
): Promise<HandlerResult> {
  try {
    const data = await fn();
    return {
      type: 'ok',
      outputs: [{
        kind,
        // Agents return structured interfaces; HandlerOutput stores them as JSON.
        payload:     data as unknown as Record<string, unknown>,
        preview_url: opts.preview_url?.(data),
        model:       opts.model,
      }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const transient = /timeout|rate.?limit|ECONN|503|504|overloaded|ETIMEDOUT|fetch failed/i.test(msg);
    return transient
      ? { type: 'retry', error: msg }
      : { type: 'fail',  error: msg };
  }
}

// -----------------------------------------------------------------------------
// content:generate_image → ImageGenerateAgent
// -----------------------------------------------------------------------------
// Caller supplies the full ImageGenerateInput in job.input. Brand-related
// fields (brandContext, colors, forbiddenWords, noEmojis) must be supplied
// by the upstream caller — this handler stays thin and does not re-derive
// them from the brand row. That's what the orchestrator is for.
const imageGenerateHandler: AgentHandler = async (job) => {
  // brandId is optional on this agent (for asset upload); we don't enforce it.
  const rawInput = job.input as unknown as ImageGenerateInput & {
    _post_id?: string;
    _photo_index?: number;
    _original_prompt?: string;
  };
  const { _post_id, _photo_index, _original_prompt, ...agentInput } = rawInput;
  const input = { ...agentInput, brandId: job.brand_id ?? undefined };

  const result = await runPlain(
    () => runImageGenerateAgent(input),
    'image',
    {
      model: 'nanobanana-v2',
      preview_url: (out) => out.imageUrl as string,
    },
  );

  // If this job was triggered for a specific post, auto-queue validate_image
  if (result.type === 'ok' && _post_id && job.brand_id) {
    const generatedUrl = result.outputs?.[0]?.preview_url;
    if (generatedUrl) {
      const { createAdminClient } = await import('@/lib/supabase');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = createAdminClient() as any;
      await db.from('agent_jobs').insert({
        brand_id:      job.brand_id,
        agent_type:    'content',
        action:        'validate_image',
        input: {
          post_id:         _post_id,
          image_url:       generatedUrl,
          original_prompt: _original_prompt ?? agentInput.userPrompt ?? '',
          attempt_number:  1,
          _photo_index:    _photo_index ?? 0,
        },
        status:        'pending',
        priority:      job.priority ?? 70,
        max_attempts:  3,
        requested_by:  'agent',
        parent_job_id: job.id,
      });
    }
  }

  return result;
};

// -----------------------------------------------------------------------------
// content:generate_video → VideoGenerateAgent
// -----------------------------------------------------------------------------
const videoGenerateHandler: AgentHandler = async (job) => {
  const input = { ...(job.input as unknown as VideoGenerateInput), brandId: job.brand_id ?? undefined };
  return runPlain(
    () => runVideoGenerateAgent(input),
    'video',
    {
      model: 'runway-gen4-turbo',
      preview_url: (out) => out.videoUrl as string,
    },
  );
};

// -----------------------------------------------------------------------------
// content:generate_human_photo → HiggsFieldAgent (foto con personas)
// -----------------------------------------------------------------------------
// Se activa cuando la solicitud requiere personas/sujetos humanos en una foto.
// Usa Higgsfield AI cloud en lugar de NanoBanana.
const higgsPhotoHandler: AgentHandler = async (job) => {
  const input: HiggsFieldInput = {
    ...(job.input as unknown as HiggsFieldInput),
    format:  'photo',
    brandId: job.brand_id ?? undefined,
  };
  return runPlain(
    () => runHiggsFieldAgent(input),
    'image',
    {
      model:       'higgsfield-photo',
      preview_url: (out) => out.mediaUrl as string,
    },
  );
};

// -----------------------------------------------------------------------------
// content:generate_human_video → HiggsFieldAgent (vídeo con personas)
// -----------------------------------------------------------------------------
// Se activa cuando la solicitud requiere personas en un vídeo/reel.
// Usa Higgsfield AI cloud en lugar de RunwayML.
const higgsVideoHandler: AgentHandler = async (job) => {
  const input: HiggsFieldInput = {
    ...(job.input as unknown as HiggsFieldInput),
    format:  'video',
    brandId: job.brand_id ?? undefined,
  };
  return runPlain(
    () => runHiggsFieldAgent(input),
    'video',
    {
      model:       'higgsfield-video',
      preview_url: (out) => out.mediaUrl as string,
    },
  );
};

// -----------------------------------------------------------------------------
// content:apply_edit → ImageEditAgent
// -----------------------------------------------------------------------------
const imageEditHandler: AgentHandler = async (job) => {
  const input = { ...(job.input as unknown as ImageEditInput), brandId: job.brand_id ?? undefined };
  return runPlain(
    () => runImageEditAgent(input),
    'image',
    {
      model: 'nanobanana-v2-img2img',
      preview_url: (out) => out.editedImageUrl as string,
    },
  );
};

// -----------------------------------------------------------------------------
// content:seasonal_content → generateSeasonalContent
// -----------------------------------------------------------------------------
const seasonalHandler: AgentHandler = async (job) => {
  return runPlain(
    () => generateSeasonalContent(job.input as Parameters<typeof generateSeasonalContent>[0]),
    'strategy',
    { model: 'seasonal-agent' },
  );
};

// -----------------------------------------------------------------------------
// content:adapt_trend → adaptTrendToBrand
// -----------------------------------------------------------------------------
const adaptTrendHandler: AgentHandler = async (job) => {
  return runPlain(
    () => adaptTrendToBrand(job.input as unknown as TrendsAdaptInput),
    'strategy',
    { model: 'trends-agent' },
  );
};

// -----------------------------------------------------------------------------
// content:analyze_inspiration → analyzeReference
// -----------------------------------------------------------------------------
const inspirationHandler: AgentHandler = async (job) => {
  return runPlain(
    () => analyzeReference(job.input as unknown as AnalyzeReferenceInput),
    'analysis',
    { model: 'inspiration-agent' },
  );
};

// -----------------------------------------------------------------------------
// analytics:detect_trends → detectTrendsBySector
// -----------------------------------------------------------------------------
// Upstream signature: (sector, ciudad, semanaActual) → TrendsDetectionResult
// If the caller omits ciudad/semanaActual we fall back to sensible defaults
// so the handler stays ergonomic.
const detectTrendsHandler: AgentHandler = async (job) => {
  const input = job.input as { sector: string; ciudad?: string; semanaActual?: string };
  const ciudad = input.ciudad ?? 'España';
  const week = input.semanaActual ?? (() => {
    const d = new Date();
    const y = d.getUTCFullYear();
    const start = new Date(Date.UTC(y, 0, 1));
    const diff = (d.getTime() - start.getTime()) / 86_400_000;
    const week = Math.ceil((diff + start.getUTCDay() + 1) / 7);
    return `${y}-W${String(week).padStart(2, '0')}`;
  })();
  return runPlain(
    () => detectTrendsBySector(input.sector, ciudad, week),
    'analysis',
    { model: 'trends-agent' },
  );
};

// -----------------------------------------------------------------------------
// analytics:analyze_competitor → analyzeCompetitor
// -----------------------------------------------------------------------------
const competitorHandler: AgentHandler = async (job) => {
  const guard = requireBrandId(job);
  if (typeof guard !== 'string') return guard;
  return runPlain(
    () => analyzeCompetitor(job.input as Parameters<typeof analyzeCompetitor>[0]),
    'analysis',
    { model: 'competitor-agent' },
  );
};

// -----------------------------------------------------------------------------
// growth:retention_email → generateRetentionEmail
// -----------------------------------------------------------------------------
const retentionEmailHandler: AgentHandler = async (job) => {
  return runPlain(
    () => generateRetentionEmail(job.input as Parameters<typeof generateRetentionEmail>[0]),
    'reply',
    { model: 'churn-agent' },
  );
};

// -----------------------------------------------------------------------------
// Register all local handlers
// -----------------------------------------------------------------------------
export function registerLocalAgentHandlers(): void {
  registerHandler({ agent_type: 'content',   action: 'generate_image'        }, imageGenerateHandler);
  registerHandler({ agent_type: 'content',   action: 'generate_video'        }, videoGenerateHandler);
  registerHandler({ agent_type: 'content',   action: 'generate_human_photo'  }, higgsPhotoHandler);
  registerHandler({ agent_type: 'content',   action: 'generate_human_video'  }, higgsVideoHandler);
  registerHandler({ agent_type: 'content',   action: 'apply_edit'            }, imageEditHandler);
  registerHandler({ agent_type: 'content',   action: 'seasonal_content'    }, seasonalHandler);
  registerHandler({ agent_type: 'content',   action: 'adapt_trend'         }, adaptTrendHandler);
  registerHandler({ agent_type: 'content',   action: 'analyze_inspiration' }, inspirationHandler);
  registerHandler({ agent_type: 'analytics', action: 'detect_trends'       }, detectTrendsHandler);
  registerHandler({ agent_type: 'analytics', action: 'analyze_competitor'  }, competitorHandler);
  registerHandler({ agent_type: 'growth',    action: 'retention_email'     }, retentionEmailHandler);
}
