// =============================================================================
// strategy:regenerate_idea
// =============================================================================
// Regenerates a single content_ideas row based on the client's comment and
// the brand's recent feedback history. Invoked mid-week when the client
// presses "↺ Otra versión" on an idea.
//
// Inputs (job.input):
//   { original_idea_id: string, week_id: string, comment: string | null }
//
// Effects:
//   - INSERT a new content_ideas row linked via original_idea_id
//   - UPDATE the original to status='replaced_by_variation'
//   - Route the new idea via routeIdea() (worker_notifications if
//     worker_review is required)
//
// On permanent failure, revert the original back to 'pending' so the
// UI does not leave the client stuck on "Estamos generando…".

import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient }                                 from '@/lib/supabase';
import { loadBrand }                                         from '../helpers';
import { loadFavoritesBlock, loadBrandMaterialBlock }        from './context-blocks';
import { routeIdea }                                         from '@/lib/idea-dispatch';
import {
  getHumanReviewDefaults,
  resolveHumanReviewConfig,
}                                                            from '@/lib/human-review';
import type { AgentJob, HandlerResult }                      from '../types';
import type { PostFormat, Priority }                         from './types';
import type { ContentIdea as DbContentIdea, ContentIdeaFormat } from '@/types';

const client = new Anthropic();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

// -----------------------------------------------------------------------------
// Prompt
// -----------------------------------------------------------------------------

const SYSTEM_PROMPT = `Eres un estratega de contenido que genera variaciones de ideas para Instagram cuando el cliente pide una versión alternativa.

Recibirás:
- La IDEA ORIGINAL que el cliente no quiere tal como está
- El COMMENT del cliente explicando qué le gustaría cambiar (puede estar vacío)
- Los últimos FEEDBACKS del cliente sobre otras ideas (contexto de qué rechaza sistemáticamente)
- El contexto del negocio y su material de marca

Tu tarea: devolver UNA sola idea nueva (no un array).

REGLAS ESTRICTAS:
- NO repitas el mismo ángulo/enfoque que el cliente acaba de rechazar
- Si el comment del cliente es específico, síguelo
- Si el comment es vago o está vacío, propón un ángulo distinto dentro de la misma categoría y formato
- Respeta la category_key y el format de la idea original salvo que el comment pida cambiarlos explícitamente
- "format" usa SOLO: "foto", "carrusel", "reel", "story", "video"
- "priority": mantén la prioridad de la idea original
- "rationale" es UNA frase que explica por qué esta variación responde al feedback
- "caption_angle" es un gancho breve (≤ 12 palabras)
- "asset_hint" describe QUÉ foto/vídeo hay que hacer o usar

Devuelve SOLO JSON válido con ESTA estructura:
{
  "title": "Rutina full body 20min versión express",
  "category_key": "workouts/full_body",
  "format": "reel",
  "priority": "alta",
  "rationale": "El cliente pidió menos rollo motivacional — ángulo práctico y corto.",
  "caption_angle": "20 min, 0 excusas",
  "asset_hint": "grabar rutina en zona funcional con cortes rápidos"
}`;

// -----------------------------------------------------------------------------
// LLM output shape
// -----------------------------------------------------------------------------

interface LlmIdea {
  title:         string;
  category_key:  string;
  format:        PostFormat;
  priority:      Priority;
  rationale:     string;
  caption_angle: string;
  asset_hint:    string;
}

const VALID_FORMATS: ReadonlySet<PostFormat>    = new Set(['foto', 'carrusel', 'reel', 'story', 'video']);
const VALID_PRIORITIES: ReadonlySet<Priority>   = new Set(['alta', 'media', 'baja']);

function validateLlmIdea(out: unknown): LlmIdea {
  if (!out || typeof out !== 'object') throw new Error('Output is not an object');
  const o = out as Record<string, unknown>;
  if (typeof o.title !== 'string' || !o.title)               throw new Error('Missing title');
  if (typeof o.category_key !== 'string' || !o.category_key) throw new Error('Missing category_key');
  if (typeof o.format !== 'string' || !VALID_FORMATS.has(o.format as PostFormat))
    throw new Error(`Invalid format: ${String(o.format)}`);
  if (typeof o.priority !== 'string' || !VALID_PRIORITIES.has(o.priority as Priority))
    throw new Error(`Invalid priority: ${String(o.priority)}`);
  return {
    title:         o.title,
    category_key:  o.category_key,
    format:        o.format as PostFormat,
    priority:      o.priority as Priority,
    rationale:     typeof o.rationale     === 'string' ? o.rationale     : '',
    caption_angle: typeof o.caption_angle === 'string' ? o.caption_angle : '',
    asset_hint:    typeof o.asset_hint    === 'string' ? o.asset_hint    : '',
  };
}

// Mirror of src/lib/planning/parse-ideas.ts:mapFormat — kept inline to
// avoid a dependency between strategy/ and planning/.
function mapFormatToDb(raw: string): ContentIdeaFormat {
  switch (raw.toLowerCase()) {
    case 'carrusel':
    case 'carousel': return 'carousel';
    case 'reel':     return 'reel';
    case 'story':    return 'story';
    case 'video':    return 'reel';
    default:         return 'image';
  }
}

// -----------------------------------------------------------------------------
// Recent feedbacks loader
// -----------------------------------------------------------------------------

interface FeedbackRow {
  action:     string;
  comment:    string | null;
  created_at: string;
}

async function loadRecentFeedbacksBlock(db: DB, brandId: string): Promise<string> {
  const { data } = await db
    .from('client_feedback')
    .select('action, comment, created_at')
    .eq('brand_id', brandId)
    .not('comment', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);

  const rows = (data ?? []) as FeedbackRow[];
  if (rows.length === 0) return '';
  const lines = rows.map((r) => `• [${r.action}] "${(r.comment ?? '').slice(0, 160)}"`);
  return `\n\nFEEDBACK RECIENTE DEL CLIENTE (últimos 5 con comentario, más nuevo primero):\n${lines.join('\n')}`;
}

// -----------------------------------------------------------------------------
// LLM call
// -----------------------------------------------------------------------------

// Haiku 4-5 pricing: $0.80/M input, $4.00/M output
const HAIKU_INPUT_PRICE  = 0.0000008;
const HAIKU_OUTPUT_PRICE = 0.000004;

async function callLLM(userBlock: string): Promise<{ idea: LlmIdea; tokensIn: number; tokensOut: number }> {
  const message = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 900,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: 'user', content: userBlock }],
  });

  const textBlock = message.content.find((c) => c.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('LLM returned no text content');
  }
  const cleaned = textBlock.text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('LLM returned invalid JSON');
  }

  return {
    idea:      validateLlmIdea(parsed),
    tokensIn:  message.usage.input_tokens,
    tokensOut: message.usage.output_tokens,
  };
}

// -----------------------------------------------------------------------------
// Public entry: pure compute (no side effects). Returns the LLM idea shape.
// -----------------------------------------------------------------------------

export async function generateIdeaVariationForBrand(params: {
  brandId:  string;
  original: DbContentIdea;
  comment:  string | null;
}): Promise<{ idea: LlmIdea; tokensIn: number; tokensOut: number }> {
  const brand = await loadBrand(params.brandId);
  if (!brand) throw new Error(`Brand not found: ${params.brandId}`);

  const db = createAdminClient() as DB;

  const brandBlock = [
    `Negocio: ${brand.name}`,
    `Sector: ${brand.sector ?? 'otro'}`,
    brand.brand_voice_doc && `Voz de marca: ${String(brand.brand_voice_doc).slice(0, 500)}`,
  ].filter(Boolean).join('\n');

  const [favoritesBlock, materialBlock, feedbacksBlock] = await Promise.all([
    loadFavoritesBlock(db, params.brandId).catch(() => ''),
    loadBrandMaterialBlock(db, params.brandId).catch(() => ''),
    loadRecentFeedbacksBlock(db, params.brandId).catch(() => ''),
  ]);

  const originalBlock = [
    'IDEA ORIGINAL:',
    `  título:         ${params.original.angle ?? '—'}`,
    `  hook:           ${params.original.hook ?? '—'}`,
    `  format (db):    ${params.original.format}`,
    `  category_id:    ${params.original.category_id ?? '—'}`,
    params.original.copy_draft ? `  copy_draft:     ${params.original.copy_draft.slice(0, 300)}` : null,
  ].filter(Boolean).join('\n');

  const commentBlock = params.comment && params.comment.trim()
    ? `\n\nCOMMENT DEL CLIENTE:\n  "${params.comment.trim().slice(0, 500)}"`
    : '\n\nCOMMENT DEL CLIENTE: (vacío — el cliente no especificó qué cambiar)';

  const userBlock = [
    brandBlock,
    favoritesBlock,
    materialBlock,
    feedbacksBlock,
    '',
    originalBlock,
    commentBlock,
    '',
    'Genera UNA variación de esta idea que atienda el comment del cliente.',
  ].join('\n');

  console.log(`[regenerate-idea] brand=${params.brandId} prompt_chars=${userBlock.length}`);

  return callLLM(userBlock);
}

// Re-export type for callers
export type { LlmIdea };

// -----------------------------------------------------------------------------
// Error classification
// -----------------------------------------------------------------------------

function isTransient(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /timeout|rate.?limit|overloaded|503|504|ECONN|ETIMEDOUT/i.test(msg);
}

async function revertOriginalToPending(db: DB, originalId: string, jobId: string): Promise<void> {
  const { error } = await db
    .from('content_ideas')
    .update({ status: 'pending' })
    .eq('id', originalId);
  if (error) {
    console.error(`[regenerate-idea][job=${jobId}] revert failed for idea=${originalId}:`, error);
  } else {
    console.warn(`[regenerate-idea][job=${jobId}] reverted idea=${originalId} regenerating → pending`);
  }
}

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------

interface RegenerateInput {
  original_idea_id: string;
  week_id:          string;
  comment:          string | null;
}

export async function regenerateIdeaHandler(job: AgentJob): Promise<HandlerResult> {
  const input = (job.input ?? {}) as Partial<RegenerateInput>;
  if (!input.original_idea_id || !input.week_id) {
    return { type: 'fail', error: 'original_idea_id and week_id are required' };
  }
  if (!job.brand_id) {
    return { type: 'fail', error: 'brand_id is required' };
  }

  const db = createAdminClient() as DB;

  // 1. Load the original idea.
  const { data: original } = await db
    .from('content_ideas')
    .select('*')
    .eq('id', input.original_idea_id)
    .single();

  if (!original) {
    return { type: 'fail', error: `Original idea not found: ${input.original_idea_id}` };
  }

  // 2. Guard against double-processing (double-click, retry after success).
  if (original.status !== 'regenerating') {
    return {
      type: 'fail',
      error: `Expected original idea status='regenerating', got '${original.status}'. Aborting to avoid duplicate variation.`,
    };
  }

  try {
    // 3. Call LLM for the variation.
    const { idea: llmIdea, tokensIn, tokensOut } = await generateIdeaVariationForBrand({
      brandId:  job.brand_id,
      original: original as DbContentIdea,
      comment:  input.comment ?? null,
    });

    const newFormat = mapFormatToDb(llmIdea.format);

    // 4. Resolve the effective human-review config and route the idea
    //    *before* inserting, so awaiting_worker_review lands correctly
    //    in a single INSERT (instead of an extra UPDATE round-trip).
    const { data: brandRow } = await db
      .from('brands')
      .select('human_review_config, name')
      .eq('id', job.brand_id)
      .single();
    const hrDefaults  = await getHumanReviewDefaults(db);
    const hrEffective = resolveHumanReviewConfig(brandRow?.human_review_config ?? null, hrDefaults);
    const decision    = routeIdea(
      {
        content_kind:        (original.content_kind ?? 'post') as 'post' | 'story',
        format:              newFormat as 'image' | 'reel' | 'carousel' | 'story',
        suggested_asset_url: null,
        rendered_image_url:  null,
      },
      hrEffective,
      { is_weekly_plan_event: false, is_regeneration: true },
    );

    // 5. INSERT the new idea linked back to the original, with the
    //    awaiting_worker_review gate already set based on the decision.
    const insertPayload = {
      week_id:                input.week_id,
      brand_id:               job.brand_id,
      agent_output_id:        null,
      category_id:            original.category_id ?? null,
      position:               original.position ?? 0,
      day_of_week:            original.day_of_week ?? null,
      format:                 newFormat,
      angle:                  llmIdea.title,
      hook:                   llmIdea.caption_angle || null,
      copy_draft:             null,
      hashtags:               null,
      suggested_asset_url:    null,
      suggested_asset_id:     null,
      status:                 'pending' as const,
      content_kind:           original.content_kind ?? 'post',
      story_type:             original.story_type ?? null,
      template_id:            original.template_id ?? null,
      rendered_image_url:     null,
      original_idea_id:       original.id,
      regeneration_reason:    input.comment ?? null,
      awaiting_worker_review: decision.route === 'worker_review',
    };

    const { data: newIdea, error: insertErr } = await db
      .from('content_ideas')
      .insert(insertPayload)
      .select()
      .single();

    if (insertErr || !newIdea) {
      throw new Error(`INSERT new idea failed: ${insertErr?.message ?? 'unknown'}`);
    }

    // 6. Flip the original.
    const { error: updateErr } = await db
      .from('content_ideas')
      .update({ status: 'replaced_by_variation' })
      .eq('id', original.id);
    if (updateErr) {
      console.error(`[regenerate-idea][job=${job.id}] flip original failed:`, updateErr);
    }

    // 7. Side-channel worker alert (notification). Coexists with the
    //    awaiting_worker_review gate: the gate governs UI visibility,
    //    the notification powers inbox/push.
    if (decision.route === 'worker_review') {
      await db.from('worker_notifications').insert({
        type:       'idea_variation_ready',
        message:    `Nueva variación lista para revisar en ${brandRow?.name ?? 'una marca'}: "${llmIdea.title.slice(0, 80)}"`,
        brand_id:   job.brand_id,
        brand_name: brandRow?.name ?? null,
        read:       false,
        metadata: {
          new_idea_id:      newIdea.id,
          original_idea_id: original.id,
          week_id:          input.week_id,
          comment:          input.comment ?? null,
          routing_reason: {
            flag_checked:    decision.flag_checked,
            effective_value: decision.effective_value,
            reason:          decision.reason,
          },
        },
      });
    }

    return {
      type: 'ok',
      outputs: [{
        kind:        'strategy',
        payload:     {
          new_idea_id:  newIdea.id,
          original_id:  original.id,
          route:        decision.route,
          flag_checked: decision.flag_checked,
        } as unknown as Record<string, unknown>,
        model:       'claude-haiku-4-5-20251001',
        tokens_used: tokensIn + tokensOut,
        cost_usd:    tokensIn * HAIKU_INPUT_PRICE + tokensOut * HAIKU_OUTPUT_PRICE,
      }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (isTransient(err)) {
      // Do not revert: let the runner retry with the original still
      // marked 'regenerating'.
      return { type: 'retry', error: msg };
    }

    // Permanent failure — revert the original so the client UI does
    // not leave the user stuck on "Estamos generando…". The guard in
    // step 2 protects against a future retry generating a duplicate
    // variation if the revert somehow races with a resubmission.
    await revertOriginalToPending(db, original.id, job.id);
    return { type: 'fail', error: msg };
  }
}
