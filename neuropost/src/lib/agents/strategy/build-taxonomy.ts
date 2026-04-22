// =============================================================================
// strategy:build_taxonomy
// =============================================================================
// Given a brand (sector + voice + target audience), asks Claude for a
// hierarchical content tree and persists it into content_categories.
// This is the ONE prompt that makes the agent multi-industry: no hardcoded
// sector list, no per-industry templates — Claude adapts on the fly.
//
// Flow:
//   1. Build the brand description block.
//   2. One LLM call with a strict JSON schema.
//   3. Parse + validate shape.
//   4. Replace any existing taxonomy for the brand (delete + insert, same
//      transaction via upsert + orphan cleanup).
//   5. Return the full taxonomy as an agent_output.
//
// Replacement semantics: building a taxonomy is idempotent. Calling it twice
// overwrites the previous tree for that brand. If you want to preserve
// historical weights after a rebuild, that's an F5 concern.

import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase';
import { loadBrand } from '../helpers';
import type { AgentJob, HandlerResult } from '../types';
import type { BuildTaxonomyOutput, TaxonomyCategory, PostFormat } from './types';

const client = new Anthropic();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

// -----------------------------------------------------------------------------
// Prompt
// -----------------------------------------------------------------------------

const SYSTEM_PROMPT = `Eres un estratega sénior de contenido para redes sociales.

Tu tarea: dado un negocio concreto, producir una taxonomía de contenido jerárquica en JSON para Instagram.

REGLAS ESTRICTAS:
- 4 a 6 categorías principales (ni menos ni más)
- 2 a 5 subcategorías por categoría
- Cada nodo debe tener weight_initial entre 0.05 y 0.45 (los de nivel 1 suman ≈ 1.0)
- recommended_formats usa SOLO: "foto", "carrusel", "reel", "story", "video"
- Adapta las categorías al sector REAL del negocio, no copies plantillas genéricas
- Si el sector es "gimnasio" piensa en rutinas, transformaciones, nutrición
- Si es "restaurante" piensa en platos, detrás-cocina, ambiente, eventos
- Si es "clínica" piensa en servicios, testimonios educativos, prevención (CUIDADO con promesas médicas)
- Si es "inmobiliaria" piensa en propiedades, barrios, procesos de compra
- Si es "ecommerce" piensa en producto, unboxing, casos de uso, tendencias
- Para CUALQUIER otro sector: razona desde primeros principios

La "rationale" es UN párrafo corto (≤ 3 frases) que explica por qué ESTE mix funciona para ESTE negocio.

Devuelve SOLO JSON válido con ESTA estructura exacta:
{
  "sector": "string",
  "categories": [
    {
      "key": "workouts",
      "name": "Rutinas de ejercicio",
      "description": "1 frase",
      "weight_initial": 0.35,
      "recommended_formats": ["reel", "carrusel"],
      "subcategories": [
        {
          "key": "workouts/full_body",
          "name": "Full body",
          "description": "1 frase",
          "weight_initial": 0.40,
          "recommended_formats": ["reel"]
        }
      ]
    }
  ],
  "rationale": "Párrafo corto."
}`;

// -----------------------------------------------------------------------------
// LLM call
// -----------------------------------------------------------------------------

// Haiku 4-5 pricing: $0.80/M input, $4.00/M output
const HAIKU_INPUT_PRICE  = 0.0000008;
const HAIKU_OUTPUT_PRICE = 0.000004;

async function callLLM(brandBlock: string): Promise<{ result: BuildTaxonomyOutput; tokensIn: number; tokensOut: number }> {
  const message = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    system:     SYSTEM_PROMPT,
    messages:   [{
      role:    'user',
      content: `${brandBlock}\n\nGenera la taxonomía de contenido para este negocio.`,
    }],
  });

  const textBlock = message.content.find((c) => c.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('LLM returned no text content');
  }
  const raw = textBlock.text.trim();

  // Claude may wrap JSON in ```json fences even when asked not to. Strip them.
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: BuildTaxonomyOutput;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('LLM returned invalid JSON');
  }

  validateTaxonomy(parsed);
  return {
    result:    parsed,
    tokensIn:  message.usage.input_tokens,
    tokensOut: message.usage.output_tokens,
  };
}

// -----------------------------------------------------------------------------
// Validation — catches Claude wandering off-schema
// -----------------------------------------------------------------------------

const VALID_FORMATS: ReadonlySet<PostFormat> = new Set([
  'foto', 'carrusel', 'reel', 'story', 'video',
]);

function validateTaxonomy(tax: BuildTaxonomyOutput): void {
  if (!tax || !Array.isArray(tax.categories)) {
    throw new Error('Taxonomy missing categories array');
  }
  if (tax.categories.length < 3 || tax.categories.length > 8) {
    throw new Error(`Taxonomy has ${tax.categories.length} top-level categories (expected 4-6)`);
  }
  for (const cat of tax.categories) {
    if (!cat.key || !cat.name) {
      throw new Error(`Category missing key/name: ${JSON.stringify(cat)}`);
    }
    if (typeof cat.weight_initial !== 'number') {
      throw new Error(`Category ${cat.key} has no numeric weight_initial`);
    }
    if (!Array.isArray(cat.recommended_formats) ||
        !cat.recommended_formats.every((f) => VALID_FORMATS.has(f as PostFormat))) {
      throw new Error(`Category ${cat.key} has invalid recommended_formats`);
    }
    if (cat.subcategories) {
      for (const sub of cat.subcategories) {
        if (!sub.key || !sub.name) {
          throw new Error(`Subcategory missing key/name under ${cat.key}`);
        }
        if (!sub.key.includes('/')) {
          // Accept either "workouts/full_body" or just "full_body" — normalize below.
        }
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Persistence — replace the whole taxonomy for the brand atomically
// -----------------------------------------------------------------------------

interface FlatRow {
  brand_id:            string;
  category_key:        string;
  name:                string;
  parent_key:          string | null;
  description:         string | null;
  weight:              number;
  recommended_formats: string[];
}

function flatten(brandId: string, tax: BuildTaxonomyOutput): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const cat of tax.categories) {
    rows.push({
      brand_id:            brandId,
      category_key:        cat.key,
      name:                cat.name,
      parent_key:          null,
      description:         cat.description ?? null,
      weight:              cat.weight_initial,
      recommended_formats: cat.recommended_formats,
    });
    for (const sub of cat.subcategories ?? []) {
      // Normalize the sub key to include the parent path if omitted.
      const subKey = sub.key.includes('/') ? sub.key : `${cat.key}/${sub.key}`;
      rows.push({
        brand_id:            brandId,
        category_key:        subKey,
        name:                sub.name,
        parent_key:          cat.key,
        description:         sub.description ?? null,
        weight:              sub.weight_initial,
        recommended_formats: sub.recommended_formats,
      });
    }
  }
  return rows;
}

async function replaceTaxonomy(brandId: string, tax: BuildTaxonomyOutput): Promise<void> {
  const db = createAdminClient() as DB;
  const rows = flatten(brandId, tax);

  // Wipe and re-insert. Not a true transaction (Supabase JS has no tx API),
  // but the window is tiny and readers tolerate it: the old rows and new
  // rows share the unique constraint (brand_id, category_key) so an upsert
  // is safer than delete-then-insert.
  //
  // Strategy: upsert new rows, then delete any rows whose category_key is
  // NOT in the new set (orphans from the previous taxonomy).
  const { error: upsertErr } = await db
    .from('content_categories')
    .upsert(rows, { onConflict: 'brand_id,category_key' });
  if (upsertErr) throw new Error(`upsert: ${upsertErr.message}`);

  const keepKeys = rows.map((r) => r.category_key);
  const { error: delErr } = await db
    .from('content_categories')
    .delete()
    .eq('brand_id', brandId)
    .not('category_key', 'in', `(${keepKeys.map((k) => `"${k}"`).join(',')})`);
  if (delErr) throw new Error(`cleanup: ${delErr.message}`);
}

// -----------------------------------------------------------------------------
// Handler entry point
// -----------------------------------------------------------------------------

export async function buildTaxonomyHandler(job: AgentJob): Promise<HandlerResult> {
  if (!job.brand_id) {
    return { type: 'fail', error: 'brand_id is required' };
  }

  try {
    const brand = await loadBrand(job.brand_id);
    if (!brand) return { type: 'fail', error: `Brand not found: ${job.brand_id}` };

    // Build the context block the LLM sees.
    const sector = brand.sector ?? 'otro';
    const voice  = brand.brand_voice_doc ?? '';
    const desc   = brand.description ?? '';
    const target = (job.input as { target_audience?: string }).target_audience
                 ?? (brand as unknown as { target_audience?: string }).target_audience
                 ?? '';

    const brandBlock = [
      `Negocio: ${brand.name}`,
      `Sector: ${sector}`,
      desc && `Descripción: ${desc}`,
      target && `Público objetivo: ${target}`,
      voice && `Voz de marca: ${voice.slice(0, 600)}`,
    ].filter(Boolean).join('\n');

    const { result: taxonomy, tokensIn, tokensOut } = await callLLM(brandBlock);
    await replaceTaxonomy(job.brand_id, taxonomy);

    return {
      type: 'ok',
      outputs: [{
        kind:        'strategy',
        payload:     taxonomy as unknown as Record<string, unknown>,
        model:       'claude-haiku-4-5-20251001',
        tokens_used: tokensIn + tokensOut,
        cost_usd:    tokensIn * HAIKU_INPUT_PRICE + tokensOut * HAIKU_OUTPUT_PRICE,
      }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const transient = /timeout|rate.?limit|overloaded|503|504|ECONN/i.test(msg);
    return transient ? { type: 'retry', error: msg } : { type: 'fail', error: msg };
  }
}
