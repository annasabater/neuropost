import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient, createAdminClient } from '@/lib/supabase';
import { checkPostLimit } from '@/lib/plan-limits';
import { requirePermission } from '@/lib/rbac';
import { syncPostIntoFeedQueue } from '@/lib/feedQueue';
import { queueJob } from '@/lib/agents/queue';
import { apiError } from '@/lib/api-utils';
import { rateLimitWrite } from '@/lib/ratelimit';
import type { Post, Brand } from '@/types';
import { PLAN_LIMITS } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

// Returns the ISO date (YYYY-MM-DD) of the Monday of the week containing `d`.
// Uses UTC to keep week boundaries deterministic regardless of server TZ.
function mondayIso(dateInput: string | Date): string | null {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff));
  return monday.toISOString().slice(0, 10);
}

interface PlanLink {
  plan_id:         string;
  plan_status:     string | null;
  plan_week_start: string | null;
}

export async function GET(request: Request) {
  try {
    const user     = await requireServerUser();
    const supabase = await createServerClient() as DB;
    const { searchParams } = new URL(request.url);
    const limit  = Number(searchParams.get('limit') ?? 20);
    const status = searchParams.get('status');

    const { data: brand } = await supabase.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ posts: [] });

    let query = supabase
      .from('posts')
      .select('*')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    const posts = (data as Post[]) ?? [];

    // ── Attach week grouping metadata (non-breaking: extra fields only) ─────
    // For each post we try to figure out which week it belongs to, and if it
    // came from a weekly plan, the plan's id + status.
    //
    //  Priority for week_key:
    //    1) post.scheduled_at (most reliable — actual publish week)
    //    2) weekly_plan.week_start (if post was produced from an idea)
    //    3) null → the UI shows it under "Sin fecha"
    const postIds = posts.map((p) => p.id);
    const planByPostId = new Map<string, PlanLink>();
    if (postIds.length > 0) {
      const { data: ideas } = await supabase
        .from('content_ideas')
        .select('post_id, week_id, weekly_plans(week_start, status)')
        .in('post_id', postIds);
      for (const raw of (ideas ?? []) as Array<{
        post_id:       string | null;
        week_id:       string | null;
        weekly_plans?: { week_start: string | null; status: string | null } | null;
      }>) {
        if (!raw.post_id || !raw.week_id) continue;
        planByPostId.set(raw.post_id, {
          plan_id:         raw.week_id,
          plan_status:     raw.weekly_plans?.status     ?? null,
          plan_week_start: raw.weekly_plans?.week_start ?? null,
        });
      }
    }

    const enriched = posts.map((p) => {
      const plan = planByPostId.get(p.id) ?? null;
      let week_key: string | null = null;
      if (p.scheduled_at)               week_key = mondayIso(p.scheduled_at);
      else if (plan?.plan_week_start)   week_key = mondayIso(plan.plan_week_start);
      return {
        ...p,
        week_key,
        plan_id:     plan?.plan_id     ?? null,
        plan_status: plan?.plan_status ?? null,
      };
    });

    return NextResponse.json({ posts: enriched });
  } catch (err) {
    return apiError(err, 'GET /api/posts');
  }
}

export async function POST(request: Request) {
  try {
    const user     = await requireServerUser();
    const body     = await request.json() as Record<string, unknown>;
    const supabase = await createServerClient() as DB;

    const { data: brandRow } = await supabase.from('brands').select('*').eq('user_id', user.id).single();
    if (!brandRow) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    const brand = brandRow as Brand;

    const permErr = await requirePermission(user.id, brand.id, 'create_post');
    if (permErr) return permErr;

    // Enforce plan limits
    const limit = await checkPostLimit(brand.id);
    if (!limit.allowed) {
      return NextResponse.json({ error: limit.reason, upgradeUrl: limit.upgradeUrl }, { status: 403 });
    }

    // Whitelist allowed fields — block privileged ones
    const {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      brand_id: _brand_id,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      approved_by: _approved_by,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ig_post_id: _ig_post_id,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      fb_post_id: _fb_post_id,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      published_at: _published_at,
      ...allowedFields
    } = body;

    // ── Delivery mode validation ──────────────────────────────────────────────
    const rawDeliveryMode = allowedFields.delivery_mode as string | undefined;
    const deliveryMode: 'instant' | 'reviewed' =
      rawDeliveryMode === 'instant' ? 'instant' : 'reviewed';

    // Starter plan cannot use instant delivery
    const planLimits = PLAN_LIMITS[brand.plan];
    if (deliveryMode === 'instant' && brand.plan === 'starter') {
      return NextResponse.json({ error: 'El modo instantáneo requiere plan Pro o superior' }, { status: 403 });
    }

    // ── Auto-publish mode: override status based on brand's publish_mode ─────
    const canAutoPublish = planLimits.autoPublish && brand.publish_mode === 'auto';
    const effectiveStatus = canAutoPublish ? 'approved' : (allowedFields.status ?? 'pending');

    const { data, error } = await supabase
      .from('posts')
      .insert({ ...allowedFields, delivery_mode: deliveryMode, brand_id: brand.id, created_by: user.id, status: effectiveStatus })
      .select()
      .single();
    if (error) throw error;

    const insertedPost = data as Post;
    await syncPostIntoFeedQueue(createAdminClient(), insertedPost);

    // Auto-publish: call shared publisher directly (avoids HTTP auth issues)
    if (canAutoPublish && insertedPost.image_url) {
      try {
        const { publishPostById } = await import('@/lib/publishPost');
        await publishPostById(insertedPost.id, user.id);
      } catch { /* non-blocking — post is already approved in DB */ }
    }

    // ── Auto-pipeline for client requests ─────────────────────────────────────
    // When a client submits a request (status:'request'), automatically start
    // the generation pipeline so the worker doesn't have to do anything manually.
    if (effectiveStatus === 'request') {
      // Notify workers: new request received
      void (supabase as DB).from('worker_notifications').insert({
        type: 'new_request',
        message: `Nueva solicitud de ${(brand as Brand).name}: ${insertedPost.caption?.slice(0, 50) ?? 'contenido'}`,
        brand_id: insertedPost.brand_id,
        brand_name: (brand as Brand).name ?? null,
        read: false,
        metadata: { post_id: insertedPost.id, format: insertedPost.format },
      }).then(() => null);

      autoStartPipeline(insertedPost, brand as Brand, deliveryMode).catch((e) =>
        console.error('[posts/POST] pipeline error', e),
      );
    }

    return NextResponse.json({ post: insertedPost }, { status: 201 });
  } catch (err) {
    return apiError(err, 'POST /api/posts');
  }
}

// =============================================================================
// autoStartPipeline — fires after a client request post is created
// =============================================================================
// Three paths:
//   A. Video/reel format    → generate_human_video (HiggsField AI)
//   B. No image (photo)     → generate_image (Replicate) → validate → caption
//   C. Image provided       → validate_image → generate_caption
//
// When VISUAL_STRATEGIST_ENABLED=true, paths B and C are preceded by the
// VisualStrategistAgent which produces an AgentBrief. The brief is persisted
// on the post and forwarded to the handler via _agent_brief in job.input.
// =============================================================================
async function autoStartPipeline(post: Post, brand: Brand, deliveryMode: 'instant' | 'reviewed' = 'reviewed'): Promise<void> {
  let clientDesc = '';
  let inspirationId: string | null = null;
  let perImageInspirationId: string | null = null;
  let videoDuration: number | null = null;
  let sourceFiles: string[] = [];
  try {
    const meta = JSON.parse(post.ai_explanation ?? '{}') as Record<string, unknown>;
    const perImg  = meta.per_image as Array<{ note?: string; inspiration_id?: string }> | undefined;
    const perNote = perImg?.[0]?.note?.trim();
    clientDesc    = perNote || String(meta.global_description ?? meta.client_notes ?? post.caption ?? '');
    perImageInspirationId = perImg?.[0]?.inspiration_id ?? null;
    inspirationId = perImageInspirationId ?? (meta.global_inspiration_ids as string[] | null)?.[0] ?? null;
    videoDuration = typeof meta.video_duration === 'number' ? meta.video_duration : null;
    sourceFiles   = Array.isArray(meta.source_files) ? (meta.source_files as string[]) : [];
  } catch {
    clientDesc = post.caption ?? '';
  }

  // Inspiration IDs may belong to legacy `inspiration_references` or to the
  // newer `inspiration_bank`. We look both up so the prompt gets enriched
  // regardless of which table the saved item lives in.
  let inspirationPrompt = '';
  if (inspirationId) {
    try {
      const db = createAdminClient() as DB;
      const { data: legacyRef } = await db
        .from('inspiration_references')
        .select('title, notes, style_tags')
        .eq('id', inspirationId).maybeSingle();
      if (legacyRef) {
        inspirationPrompt = [
          legacyRef.title ? `Inspired by: "${legacyRef.title}"` : '',
          legacyRef.notes ?? '',
          (legacyRef.style_tags as string[] | null)?.length
            ? `style: ${(legacyRef.style_tags as string[]).join(', ')}` : '',
        ].filter(Boolean).join(', ');
      } else {
        const { data: bankRef } = await db
          .from('inspiration_bank')
          .select('category, mood, tags, hidden_prompt')
          .eq('id', inspirationId).maybeSingle();
        if (bankRef) {
          inspirationPrompt = [
            bankRef.category ? `Inspired by: ${bankRef.category}` : '',
            bankRef.mood     ? `mood: ${bankRef.mood}` : '',
            (bankRef.tags as string[] | null)?.length
              ? `tags: ${(bankRef.tags as string[]).join(', ')}` : '',
            bankRef.hidden_prompt ?? '',
          ].filter(Boolean).join(', ');
        }
      }
    } catch { /* non-critical */ }
  }

  const basePrompt = [inspirationPrompt, clientDesc].filter(Boolean).join('. ')
    || `Contenido para ${brand.name}, sector ${brand.sector}`;

  const pipelineMeta = {
    _post_id:              post.id,
    _photo_index:          0,
    _original_prompt:      basePrompt,
    _auto_pipeline:        true,
    _needs_worker_review:  deliveryMode !== 'instant',
  };

  const isVideoFormat = post.format === 'video' || post.format === 'reel';

  if (isVideoFormat) {
    // Path A: Video/reel → always route to HiggsField AI (no strategist)
    await queueJob({
      brand_id:    post.brand_id,
      agent_type:  'content',
      action:      'generate_human_video',
      input: {
        userPrompt:        basePrompt,
        format:            'video' as const,
        sector:            brand.sector       ?? 'restaurante',
        visualStyle:       brand.visual_style ?? 'warm',
        brandContext:      brand.brand_voice_doc
          ?? `${brand.name} — sector ${brand.sector}, tono ${brand.tone ?? 'cercano'}`,
        referenceImageUrl: sourceFiles[0] ?? post.image_url ?? undefined,
        durationSec:       videoDuration ?? 10,
        brandId:           post.brand_id,
        colors:            brand.colors ?? null,
        forbiddenWords:    (brand.rules as { forbiddenWords?: string[] } | null)?.forbiddenWords ?? [],
        ...pipelineMeta,
      },
      priority:     80,
      requested_by: 'client',
    });
    return;
  }

  // ── Visual Strategist (Paths B & C) ─────────────────────────────────────────
  const strategistEnabled = process.env.VISUAL_STRATEGIST_ENABLED === 'true';
  let agentBrief: import('@/agents/VisualStrategistAgent').AgentBrief | null = null;

  if (strategistEnabled) {
    try {
      const { runVisualStrategist, fallbackBrief } = await import('@/agents/VisualStrategistAgent');
      const postFormat = post.format === 'story' ? 'story'
                       : post.format === 'reel'  ? 'reel_cover' : 'post';
      try {
        agentBrief = await runVisualStrategist({
          clientDescription: clientDesc,
          brandContext:      brand.brand_voice_doc
            ?? `${brand.name} — sector ${brand.sector}, tono ${brand.tone ?? 'cercano'}`,
          sector:            (brand.sector       ?? 'restaurante') as import('@/types').SocialSector,
          visualStyle:       (brand.visual_style ?? 'warm')        as import('@/types').VisualStyle,
          colors:            brand.colors ?? null,
          forbiddenWords:    (brand.rules as { forbiddenWords?: string[] } | null)?.forbiddenWords ?? [],
          format:            postFormat,
          sourceImageUrl:    sourceFiles[0] ?? post.image_url ?? null,
          inspirationPrompt: inspirationPrompt || null,
        });
      } catch (stratErr) {
        console.warn('[autoStartPipeline] VisualStrategist failed, using fallback:', stratErr);
        agentBrief = fallbackBrief({
          clientDescription: clientDesc,
          brandContext:      brand.brand_voice_doc ?? `${brand.name} — sector ${brand.sector}`,
          sector:            (brand.sector       ?? 'restaurante') as import('@/types').SocialSector,
          visualStyle:       (brand.visual_style ?? 'warm')        as import('@/types').VisualStyle,
          colors:            brand.colors ?? null,
          forbiddenWords:    [],
          format:            postFormat,
          sourceImageUrl:    sourceFiles[0] ?? post.image_url ?? null,
          inspirationPrompt: inspirationPrompt || null,
        });
      }

      // Persist brief on the post (non-blocking)
      if (agentBrief) {
        void (createAdminClient() as DB).from('posts').update({
          agent_brief:              agentBrief,
          agent_brief_generated_at: new Date().toISOString(),
        }).eq('id', post.id).then(() => null);
      }
    } catch (importErr) {
      console.warn('[autoStartPipeline] Could not import VisualStrategistAgent:', importErr);
    }
  }

  // ── Shared brand input for image jobs ─────────────────────────────────────
  const sharedBrandInput = {
    sector:         brand.sector       ?? 'restaurante',
    visualStyle:    brand.visual_style ?? 'warm',
    brandContext:   brand.brand_voice_doc
      ?? `${brand.name} — sector ${brand.sector}, tono ${brand.tone ?? 'cercano'}`,
    colors:         brand.colors ?? null,
    forbiddenWords: (brand.rules as { forbiddenWords?: string[] } | null)?.forbiddenWords ?? [],
    noEmojis:       brand.visual_style === 'elegant' || brand.visual_style === 'dark',
    format:         post.format === 'story' ? 'story'
                  : post.format === 'reel'  ? 'reel_cover' : 'post',
    brandId:        post.brand_id,
  };

  if (!post.image_url) {
    // Path B: no image → generate from scratch (Replicate)
    await queueJob({
      brand_id:    post.brand_id,
      agent_type:  'content',
      action:      'generate_image',
      input: {
        userPrompt:   basePrompt,
        ...sharedBrandInput,
        ...(agentBrief ? { _agent_brief: agentBrief } : {}),
        ...pipelineMeta,
      },
      priority:     80,
      requested_by: 'client',
    });
  } else {
    // Path C: user uploaded a photo → img2img via NanoBanana
    const numOutputs = (() => {
      try {
        const meta = JSON.parse(post.ai_explanation ?? '{}') as Record<string, unknown>;
        const extra = typeof meta.extra_photos === 'number' ? meta.extra_photos : 0;
        return Math.min(1 + extra, 4);
      } catch { return 1; }
    })();
    await queueJob({
      brand_id:    post.brand_id,
      agent_type:  'content',
      action:      'generate_image',
      input: {
        userPrompt:        basePrompt,
        ...sharedBrandInput,
        referenceImageUrl: sourceFiles[0] ?? post.image_url ?? undefined,
        editStrength:      0.65,
        numOutputs,
        ...(agentBrief ? { _agent_brief: agentBrief } : {}),
        ...pipelineMeta,
      },
      priority:     80,
      requested_by: 'client',
    });
  }
}
