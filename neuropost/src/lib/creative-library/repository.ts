// ─────────────────────────────────────────────────────────────────────────────
//  Creative library — data-access layer
//
//  Nobody else should read/write biblioteca_creativa or receta_usos
//  directly — go through these helpers so the schema can evolve without
//  scattering refactors.
// ─────────────────────────────────────────────────────────────────────────────

import { createAdminClient } from '@/lib/supabase';
import { toPgVector } from '@/lib/embeddings';
import type { CreativeRecipe } from '@neuropost/agents';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

// ─── Public types ────────────────────────────────────────────────────────────

export interface IndexRecipeInput {
  recipe:       CreativeRecipe;
  embedding:    number[] | null;
  fuente?: {
    url?:       string;
    cuenta?:    string;
    plataforma: 'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'manual';
  };
  indexadoPorAgente?: boolean;
}

export interface IndexedRecipe {
  id:                 string;
  created_at:         string;
  has_embedding:      boolean;
  quality_score:      number;
  industry_vertical:  string;
}

export interface CandidateRecipe {
  id:                      string;
  receta_completa:         CreativeRecipe;
  industry_vertical:       string | null;
  sub_niche:               string | null;
  tipo:                    'image' | 'carousel' | 'video';
  quality_score:           number | null;
  internal_ranking_score:  number;
  distancia:               number | null;
}

export interface FindCandidatesQuery {
  queryEmbedding?:  number[] | null;
  industry?:        string;
  platform?:        'instagram' | 'facebook' | 'tiktok';
  excludeIds?:      string[];
  limit?:           number;
}

export interface RecordUsageInput {
  recetaId:          string;
  brandId:           string;
  postId?:           string | null;
  publicationId?:    string | null;
  postPlataformaId?: string | null;
  platform:          'instagram' | 'facebook' | 'tiktok';
  hookVariante?:     'A' | 'B' | null;
  fitScoreAlElegir?: number | null;
  publicadoAt:       Date;
}

// ─── Indexing ────────────────────────────────────────────────────────────────

/**
 * Persist a recipe + optional embedding. Returns minimal metadata the
 * caller surfaces to the UI ("Recipe indexed, score 8/10, embedding: yes").
 */
export async function indexRecipe(input: IndexRecipeInput): Promise<IndexedRecipe> {
  const db     = createAdminClient() as DB;
  const recipe = input.recipe;

  const row = {
    fuente_url:                   input.fuente?.url         ?? null,
    fuente_plataforma:            input.fuente?.plataforma  ?? 'manual',
    fuente_cuenta:                input.fuente?.cuenta      ?? null,
    indexado_por_agente:          input.indexadoPorAgente   ?? true,

    receta_completa:              recipe,

    tipo:                         recipe.type,
    plataforma_original:          recipe.platform,
    creative_prompt:              recipe.creative_prompt,
    industry_vertical:            recipe.industry_vertical,
    sub_niche:                    recipe.sub_niche ?? null,
    tags:                         recipe.tags ?? [],

    hook_type:                    recipe.hook?.type ?? null,
    hook_strength_1_10:           recipe.hook?.strength_1_10 ?? null,

    quality_score:                recipe.quality_score,
    requires_specific_location:   recipe.reusability?.requires_specific_location  ?? false,
    requires_talent_on_camera:    recipe.reusability?.requires_talent_on_camera   ?? false,
    requires_specific_props:      recipe.reusability?.requires_specific_props     ?? false,
    localization_difficulty:      recipe.reusability?.localization_difficulty     ?? null,

    embedding:                    toPgVector(input.embedding),
  };

  const { data, error } = await db
    .from('biblioteca_creativa')
    .insert(row)
    .select('id, created_at, industry_vertical, quality_score, embedding')
    .single();

  if (error) throw error;

  const typed = data as {
    id:                string;
    created_at:        string;
    industry_vertical: string;
    quality_score:     number;
    embedding:         string | null;
  };

  return {
    id:                typed.id,
    created_at:        typed.created_at,
    has_embedding:     !!typed.embedding,
    quality_score:     typed.quality_score,
    industry_vertical: typed.industry_vertical,
  };
}

// ─── Candidate search ────────────────────────────────────────────────────────

/**
 * Calls the SQL function buscar_candidatos_receta(). When
 * query.queryEmbedding is null the function falls back to
 * ranking-based ordering instead of semantic distance.
 */
export async function findCandidates(query: FindCandidatesQuery): Promise<CandidateRecipe[]> {
  const db = createAdminClient() as DB;
  const { data, error } = await db.rpc('buscar_candidatos_receta', {
    p_embedding:   toPgVector(query.queryEmbedding ?? null),
    p_industry:    query.industry    ?? null,
    p_plataforma:  query.platform    ?? null,
    p_exclude_ids: query.excludeIds  ?? [],
    p_limit:       query.limit       ?? 20,
  });
  if (error) throw error;
  return (data ?? []) as CandidateRecipe[];
}

// ─── Usage recording ─────────────────────────────────────────────────────────

export async function recordUsage(input: RecordUsageInput): Promise<string> {
  const db = createAdminClient() as DB;
  const { data, error } = await db
    .from('receta_usos')
    .insert({
      receta_id:           input.recetaId,
      brand_id:            input.brandId,
      post_id:             input.postId            ?? null,
      publication_id:      input.publicationId     ?? null,
      post_plataforma_id:  input.postPlataformaId  ?? null,
      plataforma:          input.platform,
      hook_variante:       input.hookVariante      ?? null,
      fit_score_al_elegir: input.fitScoreAlElegir  ?? null,
      publicado_at:        input.publicadoAt.toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

// ─── Maintenance helpers — used by the ranking cron (Phase 7C) ───────────────

/**
 * Calls the SQL function recalcular_ranking_recetas() that refreshes the
 * internal_ranking_score of every recipe with measured usage. Returns
 * how many rows were updated.
 */
export async function recalcRanking(): Promise<number> {
  const db = createAdminClient() as DB;
  const { data, error } = await db.rpc('recalcular_ranking_recetas');
  if (error) throw error;
  const rows = (data ?? []) as Array<{ recetas_actualizadas: number }>;
  return rows[0]?.recetas_actualizadas ?? 0;
}

/** Weekly median recompute — called by the Vercel cron. */
export async function recomputeMedianas(): Promise<number> {
  const db = createAdminClient() as DB;
  const { data, error } = await db.rpc('recompute_medianas_nicho');
  if (error) throw error;
  const rows = (data ?? []) as Array<{ nichos_actualizados: number }>;
  return rows[0]?.nichos_actualizados ?? 0;
}
