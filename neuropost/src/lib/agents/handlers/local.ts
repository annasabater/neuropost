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
import Anthropic from '@anthropic-ai/sdk';

import { registerHandler } from '../registry';
import { requireBrandId } from '../helpers';
import type { AgentHandler, AgentJob, HandlerResult } from '../types';

/** Fire-and-forget cost tracking for external provider calls. */
async function trackCost(job: AgentJob, provider: string, action: string, cost: number, extra?: { model?: string; duration_seconds?: number; tokens_input?: number; tokens_output?: number }) {
  try {
    const { createAdminClient } = await import('@/lib/supabase');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createAdminClient() as any;
    await db.from('provider_costs').insert({
      agent_job_id: job.id,
      brand_id:     job.brand_id,
      provider,
      action,
      cost_usd:     cost,
      model:        extra?.model ?? null,
      duration_seconds: extra?.duration_seconds ?? null,
      tokens_input:  extra?.tokens_input ?? null,
      tokens_output: extra?.tokens_output ?? null,
    });
  } catch { /* non-blocking */ }
}

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

  // Track cost (NanoBanana ~$0.04 per image generation)
  if (result.type === 'ok') {
    const genMs = (result.outputs?.[0]?.payload as Record<string, unknown>)?.generationMs as number | undefined;
    void trackCost(job, 'nanobanana', 'generate_image', 0.04, { model: 'nanobanana-v2', duration_seconds: genMs ? genMs / 1000 : undefined });
  }

  // When triggered for a specific post: update post with generated image(s),
  // set status → pending_worker (hidden from client), create content_queue row,
  // and queue an AI brand-kit review job.
  if (result.type === 'ok' && _post_id && job.brand_id) {
    const payload = result.outputs?.[0]?.payload as Record<string, unknown> | undefined;
    const primaryUrl     = result.outputs?.[0]?.preview_url;
    const additionalUrls = (payload?.additionalUrls as string[] | undefined) ?? [];
    const mode           = payload?.mode as string | undefined;

    if (primaryUrl) {
      const { createAdminClient } = await import('@/lib/supabase');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = createAdminClient() as any;

      // Build carousel_urls: primary + extras (for carrusel format)
      const allUrls = [primaryUrl, ...additionalUrls];

      // 1. Update post — hidden from client until worker approves
      await db.from('posts').update({
        image_url:     primaryUrl,
        carousel_urls: allUrls.length > 1 ? allUrls : null,
        status:        'pending_worker',
        ai_explanation: JSON.stringify({
          mode,
          enhanced_prompt: payload?.enhancedPrompt,
          all_urls:        allUrls,
        }),
      }).eq('id', _post_id);

      // 2. Insert content_queue row so workers can see & review it
      const { data: queueRow, error: queueErr } = await db
        .from('content_queue')
        .insert({
          post_id:  _post_id,
          brand_id: job.brand_id,
          status:   'pending_worker',
          priority: 'normal',
        })
        .select('id')
        .single();

      if (queueErr) {
        console.error('[imageGenerateHandler] Failed to insert content_queue row:', queueErr);
      }

      // 3. Queue AI brand-kit review job (non-blocking)
      try {
        const { queueJob } = await import('../queue');
        await queueJob({
          brand_id:   job.brand_id,
          agent_type: 'content',
          action:     'review_image',
          input: {
            post_id:          _post_id,
            brand_id:         job.brand_id,
            image_url:        primaryUrl,
            original_prompt:  _original_prompt ?? '',
            _queue_id:        queueRow?.id ?? null,
          },
          priority:     60,
          requested_by: 'agent',
        });
      } catch (reviewErr) {
        console.error('[imageGenerateHandler] Failed to queue review_image job:', reviewErr);
      }
    }
  }

  return result;
};

// -----------------------------------------------------------------------------
// content:generate_video → VideoGenerateAgent
// -----------------------------------------------------------------------------
const videoGenerateHandler: AgentHandler = async (job) => {
  const input = { ...(job.input as unknown as VideoGenerateInput), brandId: job.brand_id ?? undefined };
  const result = await runPlain(
    () => runVideoGenerateAgent(input),
    'video',
    {
      model: 'runway-gen4-turbo',
      preview_url: (out) => out.videoUrl as string,
    },
  );
  if (result.type === 'ok') {
    const genMs = (result.outputs?.[0]?.payload as Record<string, unknown>)?.generationMs as number | undefined;
    void trackCost(job, 'runway', 'generate_video', 0.25, { model: 'runway-gen4-turbo', duration_seconds: genMs ? genMs / 1000 : undefined });
  }
  return result;
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
  const result = await runPlain(
    () => runHiggsFieldAgent(input),
    'image',
    {
      model:       'higgsfield-photo',
      preview_url: (out) => out.mediaUrl as string,
    },
  );
  if (result.type === 'ok') {
    const genMs = (result.outputs?.[0]?.payload as Record<string, unknown>)?.generationMs as number | undefined;
    void trackCost(job, 'higgsfield', 'generate_human_photo', 0.08, { model: 'higgsfield-photo', duration_seconds: genMs ? genMs / 1000 : undefined });
  }
  return result;
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
  const result = await runPlain(
    () => runHiggsFieldAgent(input),
    'video',
    {
      model:       'higgsfield-video',
      preview_url: (out) => out.mediaUrl as string,
    },
  );
  if (result.type === 'ok') {
    const genMs = (result.outputs?.[0]?.payload as Record<string, unknown>)?.generationMs as number | undefined;
    void trackCost(job, 'higgsfield', 'generate_human_video', 0.30, { model: 'higgsfield-video', duration_seconds: genMs ? genMs / 1000 : undefined });
  }
  return result;
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
// Extended behaviour: when the caller includes `_reference_id` in the input,
// the handler saves the analysis back to inspiration_references so the prompt
// is immediately available for Replicate recreations without re-running Claude.
const inspirationHandler: AgentHandler = async (job) => {
  const guard = requireBrandId(job);
  if (typeof guard !== 'string') return guard;

  const rawInput = job.input as unknown as AnalyzeReferenceInput & { _reference_id?: string };
  const { _reference_id, ...agentInput } = rawInput;

  let result: import('@/agents/InspirationAgent').InspirationAnalysisResult;
  try {
    result = await analyzeReference(agentInput);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const transient = /timeout|rate.?limit|overloaded|503|504|ECONN/i.test(msg);
    return transient ? { type: 'retry', error: msg } : { type: 'fail', error: msg };
  }

  // Persist analysis back to inspiration_references when reference_id provided
  if (_reference_id) {
    try {
      const { createAdminClient } = await import('@/lib/supabase');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = createAdminClient() as any;
      await db.from('inspiration_references').update({
        recreation_prompt:   result.recreationPrompt,
        style_analysis:      result.styleAnalysis,
        worker_instructions: result.workerInstructions,
        suggested_caption:   result.suggestedCaption,
        suggested_hashtags:  result.suggestedHashtags,
        analysis_status:     'done',
      }).eq('id', _reference_id);
    } catch (saveErr) {
      console.error('[inspirationHandler] Failed to persist analysis:', saveErr);
      // Non-fatal: result still returned as agent output
    }
  }

  return {
    type: 'ok',
    outputs: [{
      kind:    'analysis',
      payload: result as unknown as Record<string, unknown>,
      model:   'claude-haiku-4-5-20251001',
    }],
  };
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
// content:review_image → Claude Vision brand-kit check
// -----------------------------------------------------------------------------
// Called automatically after image generation. Loads post + brand data, runs
// Claude Vision to compare the image against the brand kit, and writes the
// result back to content_queue.ai_review.
// Input: { post_id, brand_id, image_url, original_prompt, _queue_id }
// -----------------------------------------------------------------------------
const reviewImageHandler: AgentHandler = async (job) => {
  const input = job.input as {
    post_id:         string;
    brand_id:        string;
    image_url:       string;
    original_prompt: string;
    _queue_id:       string | null;
  };

  try {
    const { createAdminClient } = await import('@/lib/supabase');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createAdminClient() as any;

    // 1. Load brand context
    const { data: brand } = await db
      .from('brands')
      .select('name, sector, visual_style, brand_voice_doc, colors, rules')
      .eq('id', input.brand_id)
      .single();

    if (!brand) {
      return { type: 'fail', error: 'reviewImageHandler: brand not found' };
    }

    // 2. Build system prompt with brand context
    const brandContext = [
      `Marca: ${brand.name ?? 'desconocida'}`,
      `Sector: ${brand.sector ?? 'desconocido'}`,
      brand.visual_style ? `Estilo visual: ${brand.visual_style}` : null,
      brand.colors       ? `Colores de marca: ${JSON.stringify(brand.colors)}` : null,
      brand.rules        ? `Reglas de marca: ${brand.rules}` : null,
      brand.brand_voice_doc ? `Descripción de marca: ${brand.brand_voice_doc}` : null,
    ].filter(Boolean).join('\n');

    const systemPrompt = `Eres un director de arte experto en branding visual. Tu tarea es evaluar si una imagen generada por IA es adecuada para publicarse en redes sociales en nombre de una marca.

Contexto de la marca:
${brandContext}

Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta (sin texto adicional):
{
  "score": <número 0-10>,
  "matches_brief": <true|false>,
  "matches_brand": <true|false>,
  "issues": [<lista de strings con problemas encontrados, puede estar vacía>],
  "recommendation": <"approve"|"review"|"regenerate">,
  "summary": "<resumen en 1-2 frases de la evaluación>"
}

Criterios de puntuación:
- 8-10: Excelente, encaja perfectamente con la marca y el brief
- 6-7: Bueno, pequeños ajustes podrían mejorar el resultado
- 4-5: Aceptable pero con problemas notables
- 0-3: No apto, regenerar
Recommendation: "approve" si score >= 7, "review" si 5-6, "regenerate" si < 5`;

    // 3. Call Claude Vision
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system:     systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type:      'image',
              source: {
                type: 'url',
                url:  input.image_url,
              },
            },
            {
              type: 'text',
              text: `Brief original del cliente: "${input.original_prompt}"\n\nEvalúa esta imagen generada según los criterios indicados.`,
            },
          ],
        },
      ],
    });

    // 4. Parse the JSON result
    const rawText = response.content[0]?.type === 'text' ? response.content[0].text : '';
    let aiReview: {
      score:           number;
      matches_brief:   boolean;
      matches_brand:   boolean;
      issues:          string[];
      recommendation:  'approve' | 'review' | 'regenerate';
      summary:         string;
    };

    try {
      // Extract JSON from response (strip any surrounding text)
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      aiReview = JSON.parse(jsonMatch?.[0] ?? rawText);
    } catch {
      return { type: 'fail', error: `reviewImageHandler: could not parse Claude response: ${rawText.slice(0, 200)}` };
    }

    // 5. Save result back to content_queue
    if (input._queue_id) {
      const updatePayload: Record<string, unknown> = { ai_review: aiReview };
      // Auto-hint for workers when AI score is high
      if (aiReview.score >= 7) {
        updatePayload.status = 'auto_approved_ai';
      }
      const { error: updateErr } = await db
        .from('content_queue')
        .update(updatePayload)
        .eq('id', input._queue_id);

      if (updateErr) {
        console.error('[reviewImageHandler] Failed to save ai_review:', updateErr);
      }
    } else {
      // Fallback: find queue row by post_id
      const updatePayload: Record<string, unknown> = { ai_review: aiReview };
      if (aiReview.score >= 7) updatePayload.status = 'auto_approved_ai';
      await db
        .from('content_queue')
        .update(updatePayload)
        .eq('post_id', input.post_id)
        .eq('status', 'pending_worker');
    }

    return {
      type: 'ok',
      outputs: [{
        kind:    'analysis',
        payload: aiReview as unknown as Record<string, unknown>,
        model:   'claude-sonnet-4-20250514',
      }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const transient = /timeout|rate.?limit|overloaded|503|504|ECONN|ETIMEDOUT|fetch failed/i.test(msg);
    return transient
      ? { type: 'retry', error: msg }
      : { type: 'fail',  error: msg };
  }
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
  registerHandler({ agent_type: 'content',   action: 'review_image'        }, reviewImageHandler);
  registerHandler({ agent_type: 'analytics', action: 'detect_trends'       }, detectTrendsHandler);
  registerHandler({ agent_type: 'analytics', action: 'analyze_competitor'  }, competitorHandler);
  registerHandler({ agent_type: 'growth',    action: 'retention_email'     }, retentionEmailHandler);
}
