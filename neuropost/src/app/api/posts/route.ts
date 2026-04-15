import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient, createAdminClient } from '@/lib/supabase';
import { checkPostLimit } from '@/lib/plan-limits';
import { requirePermission } from '@/lib/rbac';
import { syncPostIntoFeedQueue } from '@/lib/feedQueue';
import { queueJob } from '@/lib/agents/queue';
import type { Post, Brand } from '@/types';
import { PLAN_LIMITS } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

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
    return NextResponse.json({ posts: (data as Post[]) ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
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

    // ── Auto-publish mode: override status based on brand's publish_mode ─────
    const planLimits = PLAN_LIMITS[brand.plan];
    const canAutoPublish = planLimits.autoPublish && brand.publish_mode === 'auto';
    const effectiveStatus = canAutoPublish ? 'approved' : (allowedFields.status ?? 'pending');

    const { data, error } = await supabase
      .from('posts')
      .insert({ ...allowedFields, brand_id: brand.id, created_by: user.id, status: effectiveStatus })
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
      autoStartPipeline(insertedPost, brand as Brand).catch((e) =>
        console.error('[posts/POST] pipeline error', e),
      );
    }

    return NextResponse.json({ post: insertedPost }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// =============================================================================
// autoStartPipeline — fires after a client request post is created
// =============================================================================
// Two paths:
//   A. No image (image_url null) → generate_image → validate_image → generate_caption
//   B. Image provided             → validate_image → generate_caption
// =============================================================================
async function autoStartPipeline(post: Post, brand: Brand): Promise<void> {
  let clientDesc = '';
  let inspirationId: string | null = null;
  try {
    const meta = JSON.parse(post.ai_explanation ?? '{}') as Record<string, unknown>;
    clientDesc    = String(meta.global_description ?? meta.client_notes ?? post.caption ?? '');
    const perImg  = meta.per_image as Array<{ inspiration_id?: string }> | undefined;
    inspirationId = perImg?.[0]?.inspiration_id ?? null;
  } catch {
    clientDesc = post.caption ?? '';
  }

  let inspirationPrompt = '';
  if (inspirationId) {
    try {
      const db = createAdminClient() as DB;
      const { data: ref } = await db
        .from('inspiration_references')
        .select('title, notes, style_tags')
        .eq('id', inspirationId).single();
      if (ref) {
        inspirationPrompt = [
          ref.title  ? `Inspired by: "${ref.title}"` : '',
          ref.notes  ?? '',
          (ref.style_tags as string[] | null)?.length
            ? `style: ${(ref.style_tags as string[]).join(', ')}` : '',
        ].filter(Boolean).join(', ');
      }
    } catch { /* non-critical */ }
  }

  const basePrompt = [inspirationPrompt, clientDesc].filter(Boolean).join('. ')
    || `Contenido para ${brand.name}, sector ${brand.sector}`;

  const pipelineMeta = {
    _post_id:         post.id,
    _photo_index:     0,
    _original_prompt: basePrompt,
    _auto_pipeline:   true,
  };

  if (!post.image_url) {
    // Path A: no image → generate from scratch
    await queueJob({
      brand_id:    post.brand_id,
      agent_type:  'content',
      action:      'generate_image',
      input: {
        userPrompt:     basePrompt,
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
        ...pipelineMeta,
      },
      priority:     80,
      requested_by: 'client',
    });
  } else {
    // Path B: image provided → validate first
    await queueJob({
      brand_id:    post.brand_id,
      agent_type:  'content',
      action:      'validate_image',
      input: {
        post_id:         post.id,
        image_url:       post.image_url,
        original_prompt: basePrompt,
        attempt_number:  1,
        ...pipelineMeta,
      },
      priority:     80,
      requested_by: 'client',
    });
  }
}
