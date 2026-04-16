// ─────────────────────────────────────────────────────────────────────────────
//  OpenAI embeddings client — text-embedding-3-small (1536 dims).
//
//  Returns `null` (not throws) when OPENAI_API_KEY is missing or the call
//  fails. The creative-library pipeline is designed to work degraded: when
//  embedding is null the candidate search falls back to metadata-only
//  filtering (industry + tags + internal_ranking_score).
//
//  Native fetch only — no new npm dependency.
// ─────────────────────────────────────────────────────────────────────────────

const OPENAI_EMBED_URL = 'https://api.openai.com/v1/embeddings';
const MODEL            = 'text-embedding-3-small' as const;
const DIMENSIONS       = 1536;

// Safety cap — the model truncates at 8192 tokens, ~ 6000 chars of English text.
// We trim aggressively so we never burn tokens on massive captions.
const MAX_INPUT_CHARS  = 6000;

export interface EmbeddingResult {
  vector:      number[];
  tokens:      number;
  model:       string;
  dimensions:  number;
}

/**
 * Returns the embedding vector for the given text, or `null` if embeddings
 * are not configured / the call fails. Callers should treat null as "no
 * semantic signal available for this record" and rely on metadata search.
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Don't log every call — would flood the runtime. One informational
    // warning at cold start is enough (add in server init if desired).
    return null;
  }

  const trimmed = (text ?? '').trim().slice(0, MAX_INPUT_CHARS);
  if (!trimmed) return null;

  try {
    const res = await fetch(OPENAI_EMBED_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: trimmed,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '(no body)');
      console.error(`[embeddings] OpenAI ${res.status}:`, body.slice(0, 400));
      return null;
    }

    const json = await res.json() as {
      data?:  Array<{ embedding: number[] }>;
      usage?: { total_tokens?: number };
    };

    const vector = json.data?.[0]?.embedding;
    if (!Array.isArray(vector) || vector.length !== DIMENSIONS) {
      console.error('[embeddings] unexpected response shape from OpenAI');
      return null;
    }

    return {
      vector,
      tokens:     json.usage?.total_tokens ?? 0,
      model:      MODEL,
      dimensions: DIMENSIONS,
    };
  } catch (err) {
    // Network / timeout — transient. Null keeps the indexing pipeline
    // progressing; a follow-up cron can backfill empty embeddings.
    console.error('[embeddings] network error:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Batches multiple texts into a single OpenAI call (the API accepts an
 * array input and returns embeddings in the same order). Useful for
 * backfill scripts that re-embed the whole library after the key is
 * configured.
 *
 * Returns an array the same length as `texts`, with `null` at positions
 * where the item was empty/invalid, or `null` globally if the key is
 * missing.
 */
export async function generateEmbeddingsBatch(
  texts: string[],
): Promise<Array<EmbeddingResult | null> | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const inputs = texts.map(t => (t ?? '').trim().slice(0, MAX_INPUT_CHARS));
  if (inputs.every(s => !s)) return inputs.map(() => null);

  try {
    const res = await fetch(OPENAI_EMBED_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: MODEL, input: inputs }),
    });

    if (!res.ok) {
      console.error(`[embeddings/batch] OpenAI ${res.status}`);
      return null;
    }

    const json = await res.json() as {
      data?: Array<{ index: number; embedding: number[] }>;
      usage?: { total_tokens?: number };
    };

    const out: Array<EmbeddingResult | null> = inputs.map(() => null);
    for (const item of (json.data ?? [])) {
      if (!Array.isArray(item.embedding) || item.embedding.length !== DIMENSIONS) continue;
      out[item.index] = {
        vector:     item.embedding,
        // Total tokens is for the whole batch — we split evenly for bookkeeping.
        tokens:     json.usage?.total_tokens
                     ? Math.floor((json.usage.total_tokens) / inputs.filter(s => s).length)
                     : 0,
        model:      MODEL,
        dimensions: DIMENSIONS,
      };
    }
    return out;
  } catch (err) {
    console.error('[embeddings/batch] network error:', err instanceof Error ? err.message : err);
    return null;
  }
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
