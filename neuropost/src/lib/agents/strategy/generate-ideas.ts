// =============================================================================
// strategy:generate_ideas
// =============================================================================
// Reads the persisted taxonomy, asks Claude for N prioritized ideas biased
// toward the top-weighted categories, and returns them as an agent_output.
//
// Inputs (job.input):
//   { count?: number }     // default 10, max 20
//
// Preconditions:
//   - strategy:build_taxonomy must have run at least once for this brand.
//     If there are no content_categories rows, the handler returns a
//     'needs_review' result suggesting to build the taxonomy first.

import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase';
import { loadBrand } from '../helpers';
import type { AgentJob, HandlerResult } from '../types';
import type { ContentIdea, PostFormat, Priority, GenerateIdeasOutput } from './types';

const client = new Anthropic();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

interface CategoryRow {
  category_key:        string;
  name:                string;
  parent_key:          string | null;
  description:         string | null;
  weight:              number;
  recommended_formats: string[] | null;
  last_published_at:   string | null;
}

// -----------------------------------------------------------------------------
// Prompt
// -----------------------------------------------------------------------------

const SYSTEM_PROMPT = `Eres un estratega de contenido que genera ideas concretas para Instagram.

Recibirás una lista de categorías ponderadas (weight refleja qué funciona mejor) y el contexto del negocio.

Tu tarea: generar exactamente N ideas de contenido, distribuidas proporcionalmente al peso de cada categoría.

REGLAS ESTRICTAS:
- Cada idea debe apuntar a una category_key que EXISTA en la lista
- "format" usa SOLO: "foto", "carrusel", "reel", "story", "video"
- "priority" usa SOLO: "alta", "media", "baja"
- Las prioridades "alta" van a las categorías con mayor weight
- "rationale" es UNA frase que menciona el dato clave (peso, recencia, engagement esperado)
- "caption_angle" es un gancho breve (≤ 12 palabras) que usará el copywriter
- "asset_hint" describe QUÉ foto/vídeo hay que hacer o usar
- Evita repetir ángulos entre ideas — cada una debe ser ejecutable en un post real distinto

Devuelve SOLO JSON válido con ESTA estructura:
{
  "ideas": [
    {
      "title": "Rutina full body 20min",
      "category_key": "workouts/full_body",
      "format": "reel",
      "priority": "alta",
      "rationale": "Full body es tu categoría top (peso 0.38) y no has publicado en 9 días.",
      "caption_angle": "20 min, sin excusas, full body",
      "asset_hint": "grabar rutina en zona funcional con plano cenital"
    }
  ]
}`;

// -----------------------------------------------------------------------------
// Format the categories block for the prompt
// -----------------------------------------------------------------------------

function renderCategoriesBlock(rows: CategoryRow[]): string {
  // Build a parent → children tree so the LLM sees the hierarchy clearly.
  const byParent = new Map<string | null, CategoryRow[]>();
  for (const r of rows) {
    const p = r.parent_key;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p)!.push(r);
  }

  const lines: string[] = [];
  const topLevel = (byParent.get(null) ?? []).sort((a, b) => b.weight - a.weight);
  for (const cat of topLevel) {
    const formats = (cat.recommended_formats ?? []).join(', ');
    lines.push(`• ${cat.category_key} [peso ${cat.weight.toFixed(2)}] — ${cat.name}${formats ? ` (formatos: ${formats})` : ''}`);
    if (cat.description) lines.push(`    ${cat.description}`);
    const subs = (byParent.get(cat.category_key) ?? []).sort((a, b) => b.weight - a.weight);
    for (const sub of subs) {
      const subFormats = (sub.recommended_formats ?? []).join(', ');
      const recency = sub.last_published_at
        ? ` (último: ${sub.last_published_at.slice(0, 10)})`
        : ' (nunca publicado)';
      lines.push(`    ◦ ${sub.category_key} [peso ${sub.weight.toFixed(2)}]${recency}${subFormats ? ` — ${subFormats}` : ''}`);
    }
  }
  return lines.join('\n');
}

// -----------------------------------------------------------------------------
// Validation — make sure Claude used real keys + valid enums
// -----------------------------------------------------------------------------

const VALID_FORMATS: ReadonlySet<PostFormat> = new Set([
  'foto', 'carrusel', 'reel', 'story', 'video',
]);
const VALID_PRIORITIES: ReadonlySet<Priority> = new Set(['alta', 'media', 'baja']);

function validateIdeas(out: GenerateIdeasOutput, knownKeys: Set<string>): void {
  if (!out || !Array.isArray(out.ideas)) {
    throw new Error('Output missing ideas array');
  }
  for (const idea of out.ideas) {
    if (!idea.title || !idea.category_key) {
      throw new Error(`Idea missing title/category_key: ${JSON.stringify(idea)}`);
    }
    if (!knownKeys.has(idea.category_key)) {
      throw new Error(`Idea refers to unknown category_key: ${idea.category_key}`);
    }
    if (!VALID_FORMATS.has(idea.format)) {
      throw new Error(`Idea has invalid format: ${idea.format}`);
    }
    if (!VALID_PRIORITIES.has(idea.priority)) {
      throw new Error(`Idea has invalid priority: ${idea.priority}`);
    }
  }
}

// -----------------------------------------------------------------------------
// LLM call
// -----------------------------------------------------------------------------

async function callLLM(
  brandBlock: string,
  categoriesBlock: string,
  count: number,
  knownKeys: Set<string>,
): Promise<ContentIdea[]> {
  const message = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 2500,
    system:     SYSTEM_PROMPT,
    messages:   [{
      role:    'user',
      content: `${brandBlock}\n\nCATEGORÍAS ACTUALES (ordenadas por peso):\n${categoriesBlock}\n\nGenera EXACTAMENTE ${count} ideas de contenido priorizadas.`,
    }],
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

  let parsed: GenerateIdeasOutput;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('LLM returned invalid JSON');
  }

  validateIdeas(parsed, knownKeys);
  return parsed.ideas;
}

// -----------------------------------------------------------------------------
// Entry point used by both the generate_ideas handler AND the plan_week
// handler (which needs the same ideas list before fanning out sub-jobs).
// -----------------------------------------------------------------------------

export async function generateIdeasForBrand(
  brandId: string,
  count: number,
): Promise<ContentIdea[]> {
  const brand = await loadBrand(brandId);
  if (!brand) throw new Error(`Brand not found: ${brandId}`);

  const db = createAdminClient() as DB;
  const { data: rows } = await db
    .from('content_categories')
    .select('category_key, name, parent_key, description, weight, recommended_formats, last_published_at')
    .eq('brand_id', brandId);

  const list = (rows ?? []) as CategoryRow[];
  if (list.length === 0) {
    throw new Error('NO_TAXONOMY');
  }

  const brandBlock = [
    `Negocio: ${brand.name}`,
    `Sector: ${brand.sector ?? 'otro'}`,
    brand.brand_voice_doc && `Voz de marca: ${brand.brand_voice_doc.slice(0, 500)}`,
  ].filter(Boolean).join('\n');

  const categoriesBlock = renderCategoriesBlock(list);
  const knownKeys = new Set(list.map((r) => r.category_key));

  return callLLM(brandBlock, categoriesBlock, count, knownKeys);
}

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------

export async function generateIdeasHandler(job: AgentJob): Promise<HandlerResult> {
  if (!job.brand_id) return { type: 'fail', error: 'brand_id is required' };

  const count = Math.min(
    Math.max(Number((job.input as { count?: number }).count ?? 10), 1),
    20,
  );

  try {
    const ideas = await generateIdeasForBrand(job.brand_id, count);
    return {
      type: 'ok',
      outputs: [{
        kind:    'strategy',
        payload: { ideas } as unknown as Record<string, unknown>,
        model:   'claude-haiku-4-5-20251001',
      }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'NO_TAXONOMY') {
      return {
        type: 'needs_review',
        reason: 'Antes de generar ideas, ejecuta strategy:build_taxonomy para este brand.',
      };
    }
    const transient = /timeout|rate.?limit|overloaded|503|504|ECONN/i.test(msg);
    return transient ? { type: 'retry', error: msg } : { type: 'fail', error: msg };
  }
}
