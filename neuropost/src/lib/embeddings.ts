// ─────────────────────────────────────────────────────────────────────────────
//  Voyage AI embeddings client — voyage-3.5 (1024 dims).
//
//  Anthropic's recommended embedding provider. We use voyage-3.5 (general
//  purpose, multilingual) because our creative-library content can be in
//  Spanish, Catalan, English, etc.
//
//  Response shape is identical to OpenAI (data[0].embedding) which keeps
//  the caller API stable — the EmbeddingResult contract below is provider-
//  agnostic, so a future swap back to OpenAI / Cohere is an env + model
//  constant change.
//
//  Graceful degradation: returns `null` (never throws) when VOYAGE_API_KEY
//  is missing or the call fails. The creative-library pipeline is built
//  to work with embeddings = NULL; candidate search falls back to
//  metadata-only filtering (industry + tags + internal_ranking_score).
//
//  Asymmetric search tip: Voyage supports `input_type: 'query' | 'document'`.
//  Indexing recipes → 'document'. Matcher search-time brief → 'query'.
//  Using the right label lifts recall ~5-10%.
//
//  Native fetch only — no new npm dependency.
// ─────────────────────────────────────────────────────────────────────────────

const VOYAGE_EMBED_URL = 'https://api.voyageai.com/v1/embeddings';
const MODEL            = 'voyage-3.5' as const;
const DIMENSIONS       = 1024;

// Safety cap — voyage-3.5 accepts up to 32k tokens per input, but real
// creative-library entries are <1k tokens. Trim defensively.
const MAX_INPUT_CHARS  = 6000;

export type EmbeddingInputType = 'document' | 'query';

export interface EmbeddingResult {
  vector:      number[];
  tokens:      number;
  model:       string;
  dimensions:  number;
}

export interface EmbeddingOptions {
  /** `'document'` for indexing recipes, `'query'` for matcher search. */
  inputType?: EmbeddingInputType;
}

/**
 * Returns the embedding vector for the given text, or `null` if embeddings
 * are not configured / the call fails. Callers treat null as "no
 * semantic signal" and rely on metadata-only candidate search.
 */
export async function generateEmbedding(
  text:  string,
  opts:  EmbeddingOptions = {},
): Promise<EmbeddingResult | null> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) return null;

  const trimmed = (text ?? '').trim().slice(0, MAX_INPUT_CHARS);
  if (!trimmed) return null;

  try {
    const res = await fetch(VOYAGE_EMBED_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:      MODEL,
        input:      [trimmed],                       // Voyage requires array
        input_type: opts.inputType ?? 'document',
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '(no body)');
      console.error(`[embeddings] Voyage ${res.status}:`, body.slice(0, 400));
      return null;
    }

    const json = await res.json() as {
      data?:  Array<{ embedding: number[]; index: number }>;
      usage?: { total_tokens?: number };
    };

    const vector = json.data?.[0]?.embedding;
    if (!Array.isArray(vector) || vector.length !== DIMENSIONS) {
      console.error(
        `[embeddings] unexpected response shape from Voyage (got ${vector?.length ?? 0} dims, expected ${DIMENSIONS})`,
      );
      return null;
    }

    return {
      vector,
      tokens:     json.usage?.total_tokens ?? 0,
      model:      MODEL,
      dimensions: DIMENSIONS,
    };
  } catch (err) {
    console.error('[embeddings] network error:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Batch helper. Sends up to 128 texts in one call (Voyage's max batch).
 * Returns an array the same length as `texts` — use null sentinels at
 * indices that failed / were empty. Returns global `null` if the key is
 * missing.
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  opts:  EmbeddingOptions = {},
): Promise<Array<EmbeddingResult | null> | null> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) return null;

  const inputs = texts.map(t => (t ?? '').trim().slice(0, MAX_INPUT_CHARS));
  if (inputs.every(s => !s)) return inputs.map(() => null);

  // Voyage tops out at 128 inputs per call. Chunk if needed.
  const BATCH = 128;
  const out: Array<EmbeddingResult | null> = new Array(inputs.length).fill(null);

  for (let off = 0; off < inputs.length; off += BATCH) {
    const chunk         = inputs.slice(off, off + BATCH);
    const nonEmptyIdxs  = chunk.map((s, i) => s ? i : -1).filter(i => i >= 0);
    const nonEmptyInput = nonEmptyIdxs.map(i => chunk[i]!);
    if (nonEmptyInput.length === 0) continue;

    try {
      const res = await fetch(VOYAGE_EMBED_URL, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model:      MODEL,
          input:      nonEmptyInput,
          input_type: opts.inputType ?? 'document',
        }),
      });

      if (!res.ok) {
        console.error(`[embeddings/batch] Voyage ${res.status}`);
        continue;
      }

      const json = await res.json() as {
        data?:  Array<{ index: number; embedding: number[] }>;
        usage?: { total_tokens?: number };
      };

      const perItem = json.usage?.total_tokens
        ? Math.floor((json.usage.total_tokens) / Math.max(1, nonEmptyInput.length))
        : 0;

      for (const item of (json.data ?? [])) {
        if (!Array.isArray(item.embedding) || item.embedding.length !== DIMENSIONS) continue;
        const originalIdx = off + nonEmptyIdxs[item.index]!;
        out[originalIdx] = {
          vector:     item.embedding,
          tokens:     perItem,
          model:      MODEL,
          dimensions: DIMENSIONS,
        };
      }
    } catch (err) {
      console.error('[embeddings/batch] network error:', err instanceof Error ? err.message : err);
    }
  }

  return out;
}

/**
 * Formats a pgvector literal for use with supabase-js. The driver accepts
 * the string `[0.1,0.2,...]` and the server-side column is typed `vector`.
 * Returns null so callers can pass it straight through.
 */
export function toPgVector(vec: number[] | null | undefined): string | null {
  if (!vec || vec.length === 0) return null;
  return `[${vec.join(',')}]`;
}

export const EMBEDDING_MODEL      = MODEL;
export const EMBEDDING_DIMENSIONS = DIMENSIONS;
