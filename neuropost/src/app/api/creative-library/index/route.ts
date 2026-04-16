// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/creative-library/index
//    body: {
//      platform:      'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'manual',
//      imageUrl?:     string,
//      caption?:      string,
//      description?:  string,
//      sourceUrl?:    string,
//      sourceAccount?:string,
//      metrics?: { views?, likes?, shares?, saves?, comments? },
//    }
//    → { recipe_id, quality_score, has_embedding, industry }
//
//  Worker-only. Synchronously extracts the creative recipe, generates an
//  OpenAI embedding (null-tolerant), and stores both in
//  biblioteca_creativa. Used by the worker portal to curate the library
//  from viral references before the automated scraper lands.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { rateLimitWrite } from '@/lib/ratelimit';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { runCreativeExtractorAgent } from '@neuropost/agents';
import { generateEmbedding } from '@/lib/embeddings';
import { indexRecipe } from '@/lib/creative-library/repository';

interface Body {
  platform?:       string;
  imageUrl?:       string;
  caption?:        string;
  description?:    string;
  sourceUrl?:      string;
  sourceAccount?:  string;
  metrics?:        {
    views?:     number;
    likes?:     number;
    shares?:    number;
    saves?:     number;
    comments?:  number;
  };
}

const VALID_PLATFORMS = new Set(['instagram', 'tiktok', 'facebook', 'youtube', 'manual']);

export async function POST(request: Request) {
  try {
    const rl = await rateLimitWrite(request);
    if (rl) return rl;

    // Worker-only — curation tool, not exposed to brands.
    await requireWorker();

    const body = await request.json().catch(() => null) as Body | null;
    if (!body || !body.platform || !VALID_PLATFORMS.has(body.platform)) {
      return NextResponse.json(
        { error: 'Body must include platform ∈ instagram|tiktok|facebook|youtube|manual' },
        { status: 400 },
      );
    }
    if (!body.imageUrl && !body.caption && !body.description) {
      return NextResponse.json(
        { error: 'At least one of imageUrl / caption / description is required' },
        { status: 400 },
      );
    }

    // Brand-agnostic context — the extractor doesn't need a brand voice.
    const result = await runCreativeExtractorAgent(
      {
        platform:      body.platform as 'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'manual',
        imageUrl:      body.imageUrl,
        caption:       body.caption,
        description:   body.description,
        sourceUrl:     body.sourceUrl,
        sourceAccount: body.sourceAccount,
        metrics:       body.metrics,
      },
      {
        businessId:       'system',
        businessName:     'NeuroPost (library indexer)',
        brandVoice: {
          tone:            'profesional',
          keywords:        [],
          forbiddenWords:  [],
          sector:          'otro',
          language:        'en',
          exampleCaptions: [],
        },
        socialAccounts:   { accessToken: '' },
        timezone:         'Europe/Madrid',
        subscriptionTier: 'pro',
      },
    );

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error?.message ?? 'Extraction failed' },
        { status: 500 },
      );
    }

    // Embedding is best-effort — null is fine, the library keeps working.
    const embedding = await generateEmbedding(result.data.embeddingText);

    const stored = await indexRecipe({
      recipe:    result.data.recipe,
      embedding: embedding?.vector ?? null,
      fuente: {
        url:        body.sourceUrl,
        cuenta:     body.sourceAccount,
        plataforma: (body.platform as 'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'manual') ?? 'manual',
      },
      indexadoPorAgente: true,
    });

    return NextResponse.json({
      recipe_id:     stored.id,
      quality_score: stored.quality_score,
      has_embedding: stored.has_embedding,
      industry:      stored.industry_vertical,
      tokens_used_embedding: embedding?.tokens ?? 0,
    });
  } catch (err) {
    // Worker-auth errors go through workerErrorResponse for 401/403.
    if (err instanceof Error && (err.message === 'FORBIDDEN' || err.message === 'UNAUTHENTICATED')) {
      const { error, status } = workerErrorResponse(err);
      return NextResponse.json({ error }, { status });
    }
    return apiError(err, 'POST /api/creative-library/index');
  }
}
