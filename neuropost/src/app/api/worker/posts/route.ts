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
import { onProposalApproved } from '@/lib/planning/proposal-hooks';

interface CreatePostBody {
  brand_id:         string;
  caption?:         string | null;
  hashtags?:        string[];
  image_url?:       string | null;
  image_urls?:      string[];   // carousel
  format:           PostFormat;
  platform?:        Platform[];
  status?:          PostStatus;
  scheduled_at?:    string | null;
  quality_score?:   number | null;
  is_story?:        boolean;
  metadata?:        Record<string, unknown>;
  /** If provided, UPDATE this existing request post instead of creating a new one */
  request_post_id?: string | null;
  /** If provided, marks the originating proposal as converted and fires the plan-completion hook */
  proposal_id?: string | null;
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

    // ── Build ai_explanation ───────────────────────────────────────────────
    // Merge from_worker marker so the client UI can identify worker proposals.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingAiExpl: Record<string, unknown> = (() => {
      const raw = (body as any).ai_explanation;
      if (!raw) return {};
      try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return { note: raw }; }
    })();

    const newImageUrl = body.image_url ?? (body.image_urls?.[0] ?? null);
    const finalStatus = body.status ?? 'pending';

    // ── Update existing request post OR insert new ─────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let post: any;

    if (body.request_post_id) {
      // Fetch the request post to preserve its original ai_explanation data.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: reqPost } = await (db as any)
        .from('posts')
        .select('ai_explanation, image_url')
        .eq('id', body.request_post_id)
        .eq('brand_id', body.brand_id)
        .single();

      const origExpl: Record<string, unknown> = (() => {
        if (!reqPost?.ai_explanation) return {};
        try { return JSON.parse(reqPost.ai_explanation); } catch { return {}; }
      })();

      const mergedExpl = JSON.stringify({
        ...origExpl,
        ...existingAiExpl,
        from_worker: true,
        // Preserve the client's original image so the detail page can compare.
        original_image_url: origExpl.original_image_url ?? reqPost?.image_url ?? null,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: updated, error } = await (db as any)
        .from('posts')
        .update({
          caption:        body.caption ?? null,
          hashtags:       body.hashtags ?? [],
          image_url:      newImageUrl,
          format:         body.format,
          platform:       body.platform ?? ['instagram'],
          status:         finalStatus,
          scheduled_at:   body.scheduled_at ?? null,
          quality_score:  body.quality_score ?? null,
          ai_explanation: mergedExpl,
          metadata:       { ...body.metadata, created_by_worker: true },
        })
        .eq('id', body.request_post_id)
        .eq('brand_id', body.brand_id)
        .select()
        .single();

      if (error) throw error;
      post = updated;
    } else {
      const aiExplanation = JSON.stringify({ ...existingAiExpl, from_worker: true });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inserted, error } = await (db as any)
        .from('posts')
        .insert({
          brand_id:       body.brand_id,
          caption:        body.caption ?? null,
          hashtags:       body.hashtags ?? [],
          image_url:      newImageUrl,
          format:         body.format,
          platform:       body.platform ?? ['instagram'],
          status:         finalStatus,
          scheduled_at:   body.scheduled_at ?? null,
          quality_score:  body.quality_score ?? null,
          is_story:       body.is_story ?? false,
          ai_explanation: aiExplanation,
          metadata:       { ...body.metadata, created_by_worker: true },
        })
        .select()
        .single();

      if (error) throw error;
      post = inserted;
    }

    // Fan-out to post_publications so the Feed "En directo" grid and the
    // publish-scheduled cron pick this up. Only when we have a concrete
    // scheduled time — pending posts stay dormant until scheduled.
    if (post?.id && finalStatus === 'scheduled' && body.scheduled_at) {
      const platforms = Array.isArray(body.platform) ? body.platform : ['instagram'];
      const validPlatforms = platforms.filter(p => ['instagram', 'facebook', 'tiktok'].includes(p));
      if (validPlatforms.length > 0) {
        const rows = validPlatforms.map((platform) => ({
          post_id:      post.id,
          platform,
          scheduled_at: body.scheduled_at,
          status:       'scheduled',
        }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as any)
          .from('post_publications')
          .upsert(rows, { onConflict: 'post_id,platform' });
      }
    }

    // Increment weekly counters for new posts only (not updates).
    if (!body.request_post_id) {
      if (body.is_story) {
        await incrementStoryCounter(body.brand_id);
      } else if (body.format === 'reel') {
        await incrementVideoCounter(body.brand_id);
      } else {
        await incrementPostCounter(body.brand_id);
      }
    }

    // ── Notify client that their content is ready ──────────────────────────
    if (finalStatus === 'pending' || finalStatus === 'scheduled') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as any).from('notifications').insert({
          brand_id: body.brand_id,
          type:     'content_ready',
          message:  'Tu contenido ya está listo — revisa la propuesta de tu equipo.',
          read:     false,
          metadata: { postId: post?.id ?? null },
        });
      } catch (notifErr) {
        console.error('[worker/posts] Failed to insert notification:', notifErr);
      }
    }

    // ── Planning hook: mark content_idea as produced, check plan completion ──
    if (body.proposal_id && post?.id) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: proposal } = await (db as any)
          .from('proposals')
          .select('content_idea_id')
          .eq('id', body.proposal_id)
          .maybeSingle();

        if (proposal?.content_idea_id) {
          await onProposalApproved({
            proposal_id:     body.proposal_id,
            content_idea_id: proposal.content_idea_id as string,
            post_id:         post.id as string,
          });
        }
      } catch (hookErr) {
        console.error('[worker/posts] Planning hook error:', hookErr);
      }
    }

    return NextResponse.json({ post }, { status: 201 });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
