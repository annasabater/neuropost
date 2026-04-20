-- ============================================================================
-- NeuroPost — Phase 7A: Creative Intelligence Library (foundation)
--
-- Builds the three tables that back the four-agent pipeline:
--   1. biblioteca_creativa  — creative recipes extracted from viral content
--   2. receta_usos          — which recipe generated which post + performance
--   3. medianas_nicho       — per-niche/platform medians for score normalisation
--
-- Also:
--   - Enables pgvector (noop if already enabled)
--   - Creates the buscar_candidatos_receta() function the matcher consumes
--   - Creates the recalcular_ranking_recetas() function the cron runs daily
--
-- Design choices:
--   - brand_id NOT cliente_id everywhere (matches existing codebase)
--   - embedding is NULLABLE so the library works before VOYAGE_API_KEY lands.
--     The candidate-search function degrades to (industry + tag) filtering
--     when no query embedding is provided.
--   - embeddings use Voyage AI voyage-3.5 (1024 dims) — Anthropic's
--     recommended partner. If you later switch to a different provider
--     with different dimensions, update both the column type here AND
--     EMBEDDING_DIMENSIONS in src/lib/embeddings.ts.
--   - No pg_cron schedules here — we drive all crons through Vercel (see
--     src/app/api/cron/creative-library-ranking).
--
-- Safe to re-run. Every CREATE uses IF NOT EXISTS / OR REPLACE.
-- ============================================================================

BEGIN;

-- pgvector — required for semantic candidate search
CREATE EXTENSION IF NOT EXISTS vector;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. biblioteca_creativa — the creative recipe library
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.biblioteca_creativa (
  id                                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Origin of the indexed content
  fuente_url                           text,
  fuente_plataforma                    text
                                         CHECK (fuente_plataforma IN
                                           ('instagram','tiktok','facebook','youtube','manual')),
  fuente_cuenta                        text,
  indexado_at                          timestamptz NOT NULL DEFAULT now(),
  indexado_por_agente                  boolean     NOT NULL DEFAULT true,

  -- Full extractor JSON output (see backend/agents/creative-extractor)
  receta_completa                      jsonb       NOT NULL,

  -- Denormalised columns for fast filtering
  tipo                                 text        NOT NULL
                                         CHECK (tipo IN ('image','carousel','video')),
  plataforma_original                  text        NOT NULL,
  creative_prompt                      text        NOT NULL,
  industry_vertical                    text,
  sub_niche                            text,
  tags                                 text[]      NOT NULL DEFAULT ARRAY[]::text[],

  hook_type                            text,
  hook_strength_1_10                   smallint,

  -- Quality + reusability flags mirrored from the recipe JSON
  quality_score                        smallint
                                         CHECK (quality_score BETWEEN 1 AND 10),
  requires_specific_location           boolean     DEFAULT false,
  requires_talent_on_camera            boolean     DEFAULT false,
  requires_specific_props              boolean     DEFAULT false,
  localization_difficulty              text
                                         CHECK (localization_difficulty IN
                                           ('easy','medium','hard')),

  -- Embedding for semantic search. NULL until VOYAGE_API_KEY is configured.
  -- 1024 dims = Voyage AI voyage-3.5 (see src/lib/embeddings.ts).
  embedding                            vector(1024),

  -- Dynamic ranking — updated daily by recalcular_ranking_recetas().
  internal_ranking_score               numeric(5,2) NOT NULL DEFAULT 5.0,
  num_veces_usada                      int         NOT NULL DEFAULT 0,
  clientes_distintos_que_la_usaron     int         NOT NULL DEFAULT 0,
  ultima_vez_usada                     timestamptz,

  estado                               text        NOT NULL DEFAULT 'activa'
                                         CHECK (estado IN ('activa','archivada','bloqueada')),
  razon_archivo                        text,

  created_at                           timestamptz NOT NULL DEFAULT now(),
  updated_at                           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_biblioteca_vertical
  ON public.biblioteca_creativa (industry_vertical, sub_niche);
CREATE INDEX IF NOT EXISTS idx_biblioteca_tags
  ON public.biblioteca_creativa USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_biblioteca_tipo
  ON public.biblioteca_creativa (tipo, estado);
CREATE INDEX IF NOT EXISTS idx_biblioteca_score
  ON public.biblioteca_creativa (internal_ranking_score DESC)
  WHERE estado = 'activa';

-- pgvector IVFFlat index — only built once at least one row with embedding
-- exists (IVFFlat struggles with empty tables). Wrap in DO block so
-- re-running on an empty DB doesn't blow up.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.biblioteca_creativa WHERE embedding IS NOT NULL LIMIT 1) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_biblioteca_embedding
             ON public.biblioteca_creativa USING ivfflat (embedding vector_cosine_ops)
             WITH (lists = 100)';
  ELSE
    RAISE NOTICE 'Skipping IVFFlat index — no embeddings yet. Create the index manually after the first embeddings are generated.';
  END IF;
END $$;

-- updated_at trigger (reuses the helper created in phase-1).
DROP TRIGGER IF EXISTS trg_biblioteca_creativa_updated ON public.biblioteca_creativa;
CREATE TRIGGER trg_biblioteca_creativa_updated
  BEFORE UPDATE ON public.biblioteca_creativa
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- 2. receta_usos — usage log for the ranking engine
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.receta_usos (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  receta_id               uuid        NOT NULL REFERENCES public.biblioteca_creativa(id) ON DELETE CASCADE,
  brand_id                uuid        NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  -- Links to our own post (posts) + publication (post_publications)
  post_id                 uuid        REFERENCES public.posts(id) ON DELETE SET NULL,
  publication_id          uuid        REFERENCES public.post_publications(id) ON DELETE SET NULL,
  -- Native platform id (IG media id, TT video id, FB post id) for easier joins
  post_plataforma_id      text,
  plataforma              text        NOT NULL
                            CHECK (plataforma IN ('instagram','facebook','tiktok')),

  hook_variante           text        CHECK (hook_variante IN ('A','B')),
  fit_score_al_elegir     numeric(4,2),

  -- Performance metrics (populated by analytics sync cron later)
  reach                   int,
  engagement_rate         numeric(5,2),
  shares_per_reach        numeric(6,4),
  saves_per_reach         numeric(6,4),
  avg_watch_time_sec      numeric(6,2),
  completion_rate         numeric(5,2),

  -- Did this post beat the niche median? (computed by the ranking cron)
  supero_mediana_nicho    boolean,

  publicado_at            timestamptz NOT NULL,
  performance_medida_at   timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usos_receta       ON public.receta_usos (receta_id);
CREATE INDEX IF NOT EXISTS idx_usos_brand        ON public.receta_usos (brand_id);
CREATE INDEX IF NOT EXISTS idx_usos_performance  ON public.receta_usos (receta_id, supero_mediana_nicho);
CREATE INDEX IF NOT EXISTS idx_usos_unmeasured   ON public.receta_usos (performance_medida_at) WHERE performance_medida_at IS NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. medianas_nicho — cached medians, recomputed weekly
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.medianas_nicho (
  id                           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nicho                        text        NOT NULL,
  sub_niche                    text,
  plataforma                   text        NOT NULL
                                 CHECK (plataforma IN ('instagram','facebook','tiktok')),

  mediana_engagement_rate      numeric(5,2),
  mediana_shares_per_reach     numeric(6,4),
  mediana_saves_per_reach      numeric(6,4),
  mediana_avg_watch_time_sec   numeric(6,2),
  mediana_completion_rate      numeric(5,2),

  muestra_size                 int         NOT NULL,
  calculado_at                 timestamptz NOT NULL DEFAULT now(),

  UNIQUE (nicho, sub_niche, plataforma)
);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. RLS
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.biblioteca_creativa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receta_usos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medianas_nicho      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_all_biblioteca" ON public.biblioteca_creativa;
CREATE POLICY "sr_all_biblioteca" ON public.biblioteca_creativa
  FOR ALL USING (auth.role() = 'service_role')
          WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "sr_all_usos" ON public.receta_usos;
CREATE POLICY "sr_all_usos" ON public.receta_usos
  FOR ALL USING (auth.role() = 'service_role')
          WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "sr_all_medianas" ON public.medianas_nicho;
CREATE POLICY "sr_all_medianas" ON public.medianas_nicho
  FOR ALL USING (auth.role() = 'service_role')
          WITH CHECK (auth.role() = 'service_role');

-- ────────────────────────────────────────────────────────────────────────────
-- 5. buscar_candidatos_receta() — semantic + metadata candidate search
--    Takes a query embedding + optional filters, returns the top 20 closest
--    active recipes. Falls back to "ranking + industry" ordering if the
--    query embedding is NULL (OPENAI_API_KEY not set yet).
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.buscar_candidatos_receta(
  p_embedding    vector(1024)                 DEFAULT NULL,
  p_industry     text                         DEFAULT NULL,
  p_plataforma   text                         DEFAULT NULL,
  p_exclude_ids  uuid[]                       DEFAULT ARRAY[]::uuid[],
  p_limit        int                          DEFAULT 20
)
RETURNS TABLE (
  id                      uuid,
  receta_completa         jsonb,
  industry_vertical       text,
  sub_niche               text,
  tipo                    text,
  quality_score           smallint,
  internal_ranking_score  numeric,
  distancia               numeric
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF p_embedding IS NOT NULL THEN
    -- Semantic ordering (cosine distance, smaller = closer)
    RETURN QUERY
    SELECT
      b.id,
      b.receta_completa,
      b.industry_vertical,
      b.sub_niche,
      b.tipo,
      b.quality_score,
      b.internal_ranking_score,
      (b.embedding <=> p_embedding)::numeric AS distancia
    FROM public.biblioteca_creativa b
    WHERE b.estado = 'activa'
      AND b.embedding IS NOT NULL
      AND (p_industry   IS NULL OR b.industry_vertical    = p_industry)
      AND (p_plataforma IS NULL OR b.plataforma_original  = p_plataforma OR b.tipo = 'image')
      AND NOT (b.id = ANY(p_exclude_ids))
    ORDER BY b.embedding <=> p_embedding
    LIMIT p_limit;
  ELSE
    -- Degraded fallback: no embedding → rank by internal score + industry match.
    RETURN QUERY
    SELECT
      b.id,
      b.receta_completa,
      b.industry_vertical,
      b.sub_niche,
      b.tipo,
      b.quality_score,
      b.internal_ranking_score,
      NULL::numeric AS distancia
    FROM public.biblioteca_creativa b
    WHERE b.estado = 'activa'
      AND (p_industry   IS NULL OR b.industry_vertical    = p_industry)
      AND (p_plataforma IS NULL OR b.plataforma_original  = p_plataforma OR b.tipo = 'image')
      AND NOT (b.id = ANY(p_exclude_ids))
    ORDER BY b.internal_ranking_score DESC, b.quality_score DESC NULLS LAST
    LIMIT p_limit;
  END IF;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. recalcular_ranking_recetas() — daily ranking refresh
--    Runs over every recipe that has at least one measured usage,
--    normalises metrics against the niche median, applies trust +
--    recency multipliers, writes the result back to
--    biblioteca_creativa.internal_ranking_score.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recalcular_ranking_recetas()
RETURNS TABLE (recetas_actualizadas int)
LANGUAGE plpgsql AS $$
DECLARE
  updated_count int;
BEGIN
  WITH stats AS (
    SELECT
      ru.receta_id,
      COUNT(*)::int                              AS num_usos,
      COUNT(DISTINCT ru.brand_id)::int           AS num_brands,
      MAX(ru.publicado_at)                       AS ultima_fecha,
      AVG(ru.engagement_rate     / NULLIF(mn.mediana_engagement_rate,   0))  AS eng_norm,
      AVG(ru.shares_per_reach    / NULLIF(mn.mediana_shares_per_reach,  0))  AS shares_norm,
      AVG(ru.saves_per_reach     / NULLIF(mn.mediana_saves_per_reach,   0))  AS saves_norm,
      AVG(ru.avg_watch_time_sec  / NULLIF(mn.mediana_avg_watch_time_sec,0)) AS watch_norm,
      AVG(ru.completion_rate     / NULLIF(mn.mediana_completion_rate,   0)) AS compl_norm
    FROM public.receta_usos ru
    JOIN public.biblioteca_creativa bc ON bc.id = ru.receta_id
    LEFT JOIN public.medianas_nicho mn
      ON mn.nicho      = bc.industry_vertical
     AND COALESCE(mn.sub_niche,'') = COALESCE(bc.sub_niche,'')
     AND mn.plataforma = ru.plataforma
    WHERE ru.performance_medida_at IS NOT NULL
    GROUP BY ru.receta_id
  )
  UPDATE public.biblioteca_creativa b
  SET
    num_veces_usada                    = s.num_usos,
    clientes_distintos_que_la_usaron   = s.num_brands,
    ultima_vez_usada                   = s.ultima_fecha,
    internal_ranking_score             = LEAST(10.0, GREATEST(0.0,
      (
        0.35 * COALESCE(s.eng_norm,     1.0) +
        0.25 * COALESCE(s.shares_norm,  1.0) +
        0.20 * COALESCE(s.saves_norm,   1.0) +
        0.10 * COALESCE(s.watch_norm,   1.0) +
        0.10 * COALESCE(s.compl_norm,   1.0)
      ) * 5.0                                                        -- rescale 0..2 → 0..10
        * LEAST(1.0, s.num_usos::numeric / 5)                        -- trust multiplier (≥5 usages for full trust)
        * EXP(-EXTRACT(EPOCH FROM (now() - s.ultima_fecha)) / 86400.0 / 60.0)  -- 60-day half-life
    )),
    updated_at                         = now()
  FROM stats s
  WHERE b.id = s.receta_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN QUERY SELECT updated_count;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. recompute_medianas_nicho() — weekly median refresh (Vercel cron triggers)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recompute_medianas_nicho()
RETURNS TABLE (nichos_actualizados int)
LANGUAGE plpgsql AS $$
DECLARE
  inserted_count int;
BEGIN
  DELETE FROM public.medianas_nicho;

  INSERT INTO public.medianas_nicho (
    nicho, sub_niche, plataforma,
    mediana_engagement_rate, mediana_shares_per_reach, mediana_saves_per_reach,
    mediana_avg_watch_time_sec, mediana_completion_rate, muestra_size
  )
  SELECT
    bc.industry_vertical,
    bc.sub_niche,
    ru.plataforma,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ru.engagement_rate)::numeric(5,2),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ru.shares_per_reach)::numeric(6,4),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ru.saves_per_reach)::numeric(6,4),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ru.avg_watch_time_sec)::numeric(6,2),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ru.completion_rate)::numeric(5,2),
    COUNT(*)
  FROM public.receta_usos ru
  JOIN public.biblioteca_creativa bc ON bc.id = ru.receta_id
  WHERE ru.publicado_at > now() - INTERVAL '90 days'
    AND ru.engagement_rate IS NOT NULL
  GROUP BY bc.industry_vertical, bc.sub_niche, ru.plataforma
  HAVING COUNT(*) >= 10;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN QUERY SELECT inserted_count;
END;
$$;

COMMIT;

-- ────────────────────────────────────────────────────────────────────────────
-- Sanity counters
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n FROM public.biblioteca_creativa;
  RAISE NOTICE 'biblioteca_creativa rows: %', n;
  SELECT count(*) INTO n FROM public.receta_usos;
  RAISE NOTICE 'receta_usos rows: %', n;
  SELECT count(*) INTO n FROM public.medianas_nicho;
  RAISE NOTICE 'medianas_nicho rows: %', n;
END $$;
