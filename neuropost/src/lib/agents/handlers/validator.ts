// =============================================================================
// content:validate_image — Image validator agent
// =============================================================================
// Step in the worker pipeline that runs AFTER image generation and BEFORE
// delivering the post for approval. Uses Claude vision to check that the
// generated image is coherent with the brand's sector and content categories.
//
// Input:
//   { post_id, image_url, original_prompt, category_key?, max_retries? }
//
// Output:
//   { approved, confidence, issues, suggested_prompt_fix, attempt_number }
//
// Retry logic: if the image is rejected and this is attempt < MAX_RETRIES+1,
// the handler emits a sub-job to regenerate the image (content:generate_image)
// with the suggested_prompt_fix, and then queues a new validate_image job.
// After MAX_RETRIES total failures the post is flagged as needs_human_review.

import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase';
import { registerHandler } from '../registry';
import type { AgentHandler, AgentJob, HandlerResult } from '../types';

const client = new Anthropic();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

const MAX_RETRIES     = parseInt(process.env.IMAGE_VALIDATION_MAX_RETRIES ?? '2', 10);
const MIN_CONFIDENCE  = parseFloat(process.env.IMAGE_VALIDATION_MIN_CONFIDENCE ?? '0.7');
const ENABLED         = process.env.IMAGE_VALIDATION_ENABLED !== 'false';

interface ValidationInput {
  post_id:         string;
  image_url:       string;
  original_prompt: string;
  category_key?:   string;    // which content category this post belongs to
  attempt_number?: number;    // 1 (default) – 3
  _photo_index?:   number;    // which photo slot in the batch (0-based)
}

interface ValidationResult {
  approved:              boolean;
  confidence:            number;
  issues:                string[];
  suggested_prompt_fix:  string | null;
}

const SYSTEM_PROMPT = `Eres un validador de contenido para Instagram de un negocio local.
Debes analizar si la imagen generada es coherente con el sector y la categoría de contenido del negocio.

Responde SOLO con un JSON válido (sin markdown, sin explicación):
{
  "approved": true | false,
  "confidence": 0.0-1.0,
  "issues": ["descripción del problema"] | [],
  "suggested_prompt_fix": "prompt mejorado si approved=false" | null
}

Criterios de RECHAZO (approved: false):
- La imagen contiene elementos claramente fuera del sector del negocio
- La imagen tiene texto ilegible, artefactos visuales graves o elementos ofensivos
- La imagen no tiene ninguna relación razonable con la categoría del post

Criterios de APROBACIÓN (approved: true):
- La imagen es coherente con el sector y la categoría, aunque no sea perfecta
- En caso de duda, aprueba — mejor un falso positivo que bloquear contenido válido`;

async function runValidation(
  imageUrl:       string,
  sector:         string,
  categories:     string,
  categoryKey:    string,
  originalPrompt: string,
): Promise<ValidationResult> {
  const msg = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system:     SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: `NEGOCIO:
- Sector: ${sector}
- Categorías de contenido autorizadas: ${categories}
- Categoría del post actual: ${categoryKey}

PROMPT ORIGINAL USADO: "${originalPrompt}"

Analiza la imagen adjunta y devuelve el JSON de validación.`,
        },
        {
          type: 'image',
          source: { type: 'url', url: imageUrl },
        },
      ],
    }],
  });

  const textBlock = msg.content.find((c) => c.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new Error('LLM returned no text');

  const cleaned = textBlock.text.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  return JSON.parse(cleaned) as ValidationResult;
}

const validateImageHandler: AgentHandler = async (job: AgentJob): Promise<HandlerResult> => {
  if (!job.brand_id) return { type: 'fail', error: 'brand_id is required' };

  const input = job.input as unknown as ValidationInput;
  if (!input.post_id)   return { type: 'fail', error: 'post_id is required' };
  if (!input.image_url) return { type: 'fail', error: 'image_url is required' };
  if (!input.original_prompt) return { type: 'fail', error: 'original_prompt is required' };

  const attemptNumber = input.attempt_number ?? 1;

  // If validation is disabled, auto-approve
  if (!ENABLED) {
    return {
      type: 'ok',
      outputs: [{
        kind:    'analysis',
        payload: { approved: true, confidence: 1.0, issues: [], suggested_prompt_fix: null, attempt_number: attemptNumber, skipped: true } as unknown as Record<string, unknown>,
        model:   'skipped',
      }],
    };
  }

  try {
    const db = createAdminClient() as DB;

    // Load brand sector + content categories
    const { data: brand } = await db
      .from('brands')
      .select('sector, name')
      .eq('id', job.brand_id)
      .maybeSingle();

    const sector = (brand as { sector?: string } | null)?.sector ?? 'negocio local';

    const { data: cats } = await db
      .from('content_categories')
      .select('category_key, name')
      .eq('brand_id', job.brand_id)
      .eq('active', true);

    const categories  = (cats ?? [])
      .map((c: { category_key: string; name: string }) => `${c.name} (${c.category_key})`)
      .join(', ') || 'contenido general del negocio';

    const categoryKey = input.category_key ?? 'general';

    // Run Claude vision validation
    const result = await runValidation(
      input.image_url,
      sector,
      categories,
      categoryKey,
      input.original_prompt,
    );

    // Apply minimum confidence threshold
    const effectiveApproval = result.approved && result.confidence >= MIN_CONFIDENCE;

    // Persist to image_validations table
    await db.from('image_validations').insert({
      post_id:              input.post_id,
      attempt_number:       attemptNumber,
      image_url:            input.image_url,
      approved:             effectiveApproval,
      confidence:           result.confidence,
      issues:               result.issues ?? [],
      suggested_prompt_fix: result.suggested_prompt_fix ?? null,
      original_prompt:      input.original_prompt,
    });

    if (effectiveApproval) {
      // Append approved image to post.generated_images and check if batch complete
      const { data: postRow } = await db
        .from('posts')
        .select('generated_images, generation_total, generation_done, brand_id')
        .eq('id', input.post_id)
        .single();

      if (postRow) {
        const existing: string[] = Array.isArray(postRow.generated_images) ? postRow.generated_images : [];
        const alreadyAdded = existing.includes(input.image_url);
        const newImages = alreadyAdded ? existing : [...existing, input.image_url];
        const newDone   = alreadyAdded ? postRow.generation_done : (postRow.generation_done ?? 0) + 1;
        const total     = postRow.generation_total ?? 1;
        const allDone   = newDone >= total;

        await db.from('posts').update({
          generated_images: newImages,
          generation_done:  newDone,
          ...(allDone ? { status: 'pending', edited_image_url: newImages[0] } : {}),
        }).eq('id', input.post_id);

        // When all images ready: queue caption generation (auto-pipeline) or notify directly
        if (allDone) {
          const isAutoPipeline = (input as unknown as Record<string, unknown>)._auto_pipeline === true;
          if (isAutoPipeline) {
            // Queue caption generation — it will notify the client when done
            await db.from('agent_jobs').insert({
              brand_id:      postRow.brand_id ?? job.brand_id,
              agent_type:    'content',
              action:        'generate_caption',
              input: {
                post_id:         input.post_id,
                image_url:       newImages[0],
                visualTags:      ['contenido', 'negocio'],
                imageAnalysis:   {
                  isSuitable: true, suitabilityReason: null,
                  dominantColors: [], composition: 'square',
                  mainSubjects: [], qualityScore: 8, qualityIssues: [],
                  lightingCondition: 'natural', suggestedCrop: null,
                },
                goal:        'engagement',
                platforms:   ['instagram'],
                postContext: input.original_prompt,
                _post_id:    input.post_id,
                _auto_pipeline: true,
              },
              status:        'pending',
              priority:      job.priority ?? 80,
              max_attempts:  3,
              requested_by:  'agent',
              parent_job_id: job.id,
            });
          } else {
            await db.from('notifications').insert({
              brand_id: postRow.brand_id ?? job.brand_id,
              type:     'approval_needed',
              message:  `Tu contenido está listo para revisar${total > 1 ? ` (${total} imágenes)` : ''}`,
              read:     false,
              metadata: { post_id: input.post_id, image_count: total },
            }).then(() => null);
          }
        }
      }

      return {
        type: 'ok',
        outputs: [{
          kind:    'analysis',
          payload: { ...result, approved: true, attempt_number: attemptNumber } as unknown as Record<string, unknown>,
          model:   'claude-haiku-4-5-20251001',
        }],
      };
    }

    // Image rejected — decide whether to retry or escalate
    if (attemptNumber >= MAX_RETRIES + 1) {
      // All retries exhausted — flag post for human review
      await db
        .from('posts')
        .update({ status: 'needs_human_review' })
        .eq('id', input.post_id);

      // Notify the worker team
      await db.from('notifications').insert({
        brand_id: job.brand_id,
        type:     'failed',
        message:  `Post ${input.post_id}: imagen rechazada tras ${attemptNumber} intentos. Requiere revisión humana.`,
        read:     false,
        metadata: { post_id: input.post_id, issues: result.issues },
      });

      return {
        type: 'ok',  // not a handler failure — the job completed, outcome is "escalated"
        outputs: [{
          kind:    'analysis',
          payload: {
            ...result,
            approved:        false,
            attempt_number:  attemptNumber,
            escalated:       true,
            human_review:    true,
          } as unknown as Record<string, unknown>,
          model: 'claude-haiku-4-5-20251001',
        }],
      };
    }

    // Queue a new generate_image job with the corrected prompt,
    // followed by a new validate_image job. Use parent_job_id for traceability.
    const newPrompt = result.suggested_prompt_fix ?? input.original_prompt;

    const { data: newImageJob } = await db.from('agent_jobs').insert({
      brand_id:      job.brand_id,
      agent_type:    'content',
      action:        'generate_image',
      input:         {
        userPrompt:       newPrompt,
        sector:           'restaurante',  // fallback — brand context loaded by handler
        visualStyle:      'warm',
        brandContext:     '',
        brandId:          job.brand_id,
        _post_id:         input.post_id,
        _photo_index:     input._photo_index ?? 0,
        _original_prompt: newPrompt,
      },
      status:        'pending',
      priority:      job.priority ?? 50,
      parent_job_id: job.id,
    }).select('id').single();

    if (newImageJob?.id) {
      await db.from('agent_jobs').insert({
        brand_id:      job.brand_id,
        agent_type:    'content',
        action:        'validate_image',
        input:         {
          post_id:         input.post_id,
          image_url:       null,           // will be filled by generate_image output
          original_prompt: newPrompt,
          category_key:    input.category_key,
          attempt_number:  attemptNumber + 1,
          _photo_index:    input._photo_index ?? 0,
          depends_on_job:  newImageJob.id,
        },
        status:        'pending',
        priority:      job.priority ?? 50,
        parent_job_id: job.id,
      });
    }

    return {
      type: 'ok',
      outputs: [{
        kind:    'analysis',
        payload: { ...result, approved: false, attempt_number: attemptNumber, retrying: true } as unknown as Record<string, unknown>,
        model:   'claude-haiku-4-5-20251001',
      }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const transient = /timeout|rate.?limit|overloaded|503|504|ECONN/i.test(msg);
    return transient ? { type: 'retry', error: msg } : { type: 'fail', error: msg };
  }
};

// =============================================================================
// content:validate_video — Video validator agent
// =============================================================================
// Validates a generated video by extracting key frames and analyzing them
// with Claude Vision. Fewer retries than images (videos are more expensive).
// Max retries: 1 (2 total attempts). Then escalates to human review.

const VIDEO_MAX_RETRIES = 1;

interface VideoValidationInput {
  post_id:         string;
  video_url:       string;
  thumbnail_url?:  string;
  original_prompt: string;
  duration?:       number;
  attempt_number?: number;
}

const VIDEO_SYSTEM_PROMPT = `Eres un validador de vídeo/reel para redes sociales de un negocio local.
Analiza el frame clave del vídeo generado y determina si es coherente con el sector del negocio.

Responde SOLO con un JSON válido:
{
  "approved": true | false,
  "confidence": 0.0-1.0,
  "issues": ["descripción del problema"] | [],
  "suggested_prompt_fix": "prompt mejorado si approved=false" | null
}

Criterios de RECHAZO: artefactos visuales graves, contenido fuera del sector del negocio, contenido ofensivo.
Criterios de APROBACIÓN: coherente con el sector, calidad aceptable para redes. En caso de duda, aprueba.`;

const validateVideoHandler: AgentHandler = async (job: AgentJob): Promise<HandlerResult> => {
  const input = job.input as unknown as VideoValidationInput;
  const db: DB = createAdminClient();
  const attemptNumber = input.attempt_number ?? 1;

  // Use thumbnail if available (cheaper than extracting frames)
  const frameUrl = input.thumbnail_url ?? input.video_url;

  try {
    // Load brand context for sector info
    let sectorInfo = '';
    if (job.brand_id) {
      const { data: brand } = await db.from('brands').select('sector, name').eq('id', job.brand_id).single();
      if (brand) sectorInfo = `Negocio: ${brand.name}, sector: ${brand.sector}`;
    }

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'url', url: frameUrl } },
          { type: 'text', text: `${VIDEO_SYSTEM_PROMPT}\n\n${sectorInfo}\nPrompt original: "${input.original_prompt}"` },
        ],
      }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text : '{}';
    let result: ValidationResult;
    try {
      result = JSON.parse(raw.replace(/```json?\n?|```/g, '').trim());
    } catch {
      result = { approved: true, confidence: 0.6, issues: [], suggested_prompt_fix: null };
    }

    if (result.approved || result.confidence >= MIN_CONFIDENCE) {
      // Video approved — update post
      await db.from('posts').update({
        status: 'pending',
        video_url: input.video_url,
        thumbnail_url: input.thumbnail_url ?? null,
      }).eq('id', input.post_id);

      return {
        type: 'ok',
        outputs: [{
          kind: 'analysis',
          payload: { ...result, approved: true, attempt_number: attemptNumber, media_type: 'video' } as unknown as Record<string, unknown>,
          model: 'claude-haiku-4-5-20251001',
        }],
      };
    }

    // Video rejected
    if (attemptNumber > VIDEO_MAX_RETRIES) {
      // Exhausted — escalate to human review
      await db.from('posts').update({ status: 'needs_human_review' }).eq('id', input.post_id);
      await db.from('notifications').insert({
        brand_id: job.brand_id,
        type: 'failed',
        message: `Post ${input.post_id}: vídeo rechazado tras ${attemptNumber} intentos. Requiere revisión humana.`,
        read: false,
        metadata: { post_id: input.post_id, issues: result.issues, media_type: 'video' },
      });

      return {
        type: 'ok',
        outputs: [{
          kind: 'analysis',
          payload: { ...result, approved: false, attempt_number: attemptNumber, escalated: true, media_type: 'video' } as unknown as Record<string, unknown>,
          model: 'claude-haiku-4-5-20251001',
        }],
      };
    }

    // Retry: queue regeneration + new validation
    const newPrompt = result.suggested_prompt_fix ?? input.original_prompt;
    await db.from('agent_jobs').insert({
      brand_id: job.brand_id,
      agent_type: 'content',
      action: 'generate_human_video',
      input: {
        userPrompt: newPrompt,
        format: 'video',
        sector: 'restaurante',
        visualStyle: 'warm',
        brandContext: '',
        brandId: job.brand_id,
        _post_id: input.post_id,
        _original_prompt: newPrompt,
      },
      status: 'pending',
      priority: job.priority ?? 50,
      parent_job_id: job.id,
    });

    return {
      type: 'ok',
      outputs: [{
        kind: 'analysis',
        payload: { ...result, approved: false, attempt_number: attemptNumber, retrying: true, media_type: 'video' } as unknown as Record<string, unknown>,
        model: 'claude-haiku-4-5-20251001',
      }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const transient = /timeout|rate.?limit|overloaded|503|504|ECONN/i.test(msg);
    return transient ? { type: 'retry', error: msg } : { type: 'fail', error: msg };
  }
};

export function registerValidatorHandlers(): void {
  registerHandler({ agent_type: 'content', action: 'validate_image' }, validateImageHandler);
  registerHandler({ agent_type: 'content', action: 'validate_video' }, validateVideoHandler);
}
