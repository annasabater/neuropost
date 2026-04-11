// =============================================================================
// Worker endpoint: create a post on behalf of a client brand
// =============================================================================
//
// Prior to this route, the worker dashboard used a direct client-side
// `supabase.from('posts').insert(...)` from the browser, which completely
// bypassed plan-limit checks. This endpoint centralises the plan gate so a
// worker on a Starter brand cannot publish a 3rd post that week, nor create
// a carousel with more photos than the plan allows.

import { NextResponse } from 'next/server';
import { requireWorkerForBrand, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';
import { checkPostLimit, checkStoryLimit, checkVideoLimit, checkFeature, incrementPostCounter, incrementStoryCounter, incrementVideoCounter } from '@/lib/plan-limits';
import { PLAN_LIMITS } from '@/types';
import type { SubscriptionPlan, PostFormat, Platform, PostStatus } from '@/types';

interface CreatePostBody {
  brand_id:        string;
  caption?:        string | null;
  hashtags?:       string[];
  image_url?:      string | null;
  image_urls?:     string[];   // carousel
  format:          PostFormat;
  platform?:       Platform[];
  status?:         PostStatus;
  scheduled_at?:   string | null;
  quality_score?:  number | null;
  is_story?:       boolean;
  metadata?:       Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as CreatePostBody;
    if (!body.brand_id) {
      return NextResponse.json({ error: 'brand_id is required' }, { status: 400 });
    }

    // Authorise the worker for this specific client brand.
    await requireWorkerForBrand(body.brand_id);

    // Load the brand to know its plan.
    const db = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: brand } = await (db as any)
      .from('brands')
      .select('id, plan')
      .eq('id', body.brand_id)
      .single();

    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const plan   = (brand.plan ?? 'starter') as SubscriptionPlan;
    const limits = PLAN_LIMITS[plan];

    // ── Plan gates ─────────────────────────────────────────────────────────

    // 1. Weekly counter: stories count separately from feed posts.
    if (body.is_story) {
      const gate = await checkStoryLimit(body.brand_id);
      if (!gate.allowed) {
        return NextResponse.json({ error: gate.reason, upgradeUrl: gate.upgradeUrl }, { status: 402 });
      }
    } else {
      const gate = await checkPostLimit(body.brand_id);
      if (!gate.allowed) {
        return NextResponse.json({ error: gate.reason, upgradeUrl: gate.upgradeUrl }, { status: 402 });
      }
    }

    // 2. Reel format uses the weekly video quota + feature check.
    if (body.format === 'reel') {
      const videoGate = await checkVideoLimit(body.brand_id);
      if (!videoGate.allowed) {
        return NextResponse.json({ error: videoGate.reason, upgradeUrl: videoGate.upgradeUrl }, { status: 402 });
      }
    }

    // 3. Carousel size must fit within the plan.
    if (body.format === 'carousel' && Array.isArray(body.image_urls) && body.image_urls.length > limits.carouselMaxPhotos) {
      return NextResponse.json({
        error:      `El plan ${plan} permite carruseles de hasta ${limits.carouselMaxPhotos} fotos (propuesto: ${body.image_urls.length}).`,
        upgradeUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/settings/plan`,
      }, { status: 402 });
    }

    // 4. Scheduled/auto-publish requires the autoPublish feature.
    if (body.status === 'scheduled' || body.scheduled_at) {
      const gate = await checkFeature(body.brand_id, 'autoPublish');
      if (!gate.allowed) {
        return NextResponse.json({ error: gate.reason, upgradeUrl: gate.upgradeUrl }, { status: 402 });
      }
    }

    // ── Insert ─────────────────────────────────────────────────────────────
    // Build an ai_explanation marker so the client UI can identify worker-sent
    // proposals without depending on the optional `metadata` jsonb column
    // (which may not exist in every environment).
    const aiExplanation = JSON.stringify({
      ...(typeof body.ai_explanation === 'string'
        ? (() => { try { return JSON.parse(body.ai_explanation as string); } catch { return { note: body.ai_explanation }; } })()
        : (body.ai_explanation ?? {})),
      from_worker: true,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: post, error } = await (db as any)
      .from('posts')
      .insert({
        brand_id:      body.brand_id,
        caption:       body.caption ?? null,
        hashtags:      body.hashtags ?? [],
        image_url:     body.image_url ?? (body.image_urls?.[0] ?? null),
        format:        body.format,
        platform:      body.platform ?? ['instagram', 'facebook'],
        status:        body.status ?? 'pending',
        scheduled_at:  body.scheduled_at ?? null,
        quality_score: body.quality_score ?? null,
        is_story:      body.is_story ?? false,
        ai_explanation: aiExplanation,
        metadata:      { ...body.metadata, created_by_worker: true },
      })
      .select()
      .single();

    if (error) throw error;

    // Increment the weekly counter so the next call sees the new total.
    if (body.is_story) {
      await incrementStoryCounter(body.brand_id);
    } else if (body.format === 'reel') {
      await incrementVideoCounter(body.brand_id);
    } else {
      await incrementPostCounter(body.brand_id);
    }

    return NextResponse.json({ post }, { status: 201 });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
