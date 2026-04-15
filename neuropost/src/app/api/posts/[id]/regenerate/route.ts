import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { brandToAgentContext } from '@/lib/agentContext';
import { runCopywriterAgent } from '@neuropost/agents';
import { canRegenerate, registerRegeneration } from '@/lib/regeneration';
import type { Brand, Post, PostVersion } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

/**
 * POST /api/posts/[id]/regenerate
 * Body: { mode: 'full' | 'copy' }
 *   full — regenerate caption + hashtags (keep image)
 *   copy — alias for full (image stays, only text changes)
 *
 * Enforces weekly regeneration limits:
 *   - First 3 regenerations per post are free
 *   - From the 4th onward, 1 post is deducted from the weekly quota
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id }   = await params;
    const user     = await requireServerUser();
    const supabase = await createServerClient() as DB;

    const { data: brand } = await supabase
      .from('brands').select('*').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { data: post, error: postError } = await supabase
      .from('posts').select('*').eq('id', id).eq('brand_id', brand.id).single();
    if (postError || !post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    // ── Quota check ────────────────────────────────────────────────────────────
    const check = await canRegenerate(id, brand.id);
    if (!check.allowed) {
      return NextResponse.json(
        { error: check.reason, upgradeUrl: check.upgradeUrl, limitReached: true },
        { status: 403 },
      );
    }

    const p = post as Post;

    // ── Regenerate copy ────────────────────────────────────────────────────────
    const prevVersions: PostVersion[] = Array.isArray(p.versions) ? p.versions : [];
    if (p.caption) {
      prevVersions.push({ caption: p.caption, hashtags: p.hashtags ?? [], savedAt: new Date().toISOString() });
    }

    const ctx    = brandToAgentContext(brand as Brand);
    const result = await runCopywriterAgent(
      {
        visualTags:    ['contenido', 'negocio'],
        imageAnalysis: {
          isSuitable:        true,
          suitabilityReason: null,
          dominantColors:    [],
          composition:       'square',
          mainSubjects:      [brand.name ?? ''],
          qualityScore:      8,
          qualityIssues:     [],
          lightingCondition: 'natural',
          suggestedCrop:     null,
        },
        goal:        'engagement',
        platforms:   Array.isArray(p.platform) ? p.platform : [p.platform ?? 'instagram'],
        postContext: `Regeneración del post para ${brand.name}. Sector: ${brand.sector}. Tono: ${brand.tone}.`,
      },
      ctx,
    );

    if (!result.success || !result.data) {
      return NextResponse.json({ error: result.error?.message ?? 'Error al regenerar' }, { status: 500 });
    }

    const primaryPlatform = Array.isArray(p.platform) ? p.platform[0] : (p.platform ?? 'instagram');
    const copy = result.data.copies[primaryPlatform] ?? Object.values(result.data.copies)[0];
    const allHashtags = [
      ...(result.data.hashtags.branded ?? []),
      ...(result.data.hashtags.niche   ?? []),
      ...(result.data.hashtags.broad   ?? []).slice(0, 3),
    ];

    const newCaption  = copy?.caption  ?? p.caption  ?? '';
    const newHashtags = allHashtags.length ? allHashtags : p.hashtags;

    const { data: updated, error: updateError } = await supabase
      .from('posts')
      .update({
        caption:        newCaption,
        hashtags:       newHashtags,
        versions:       prevVersions,
        ai_explanation: result.data.strategySummary ?? null,
        status:         'generated',
      })
      .eq('id', id)
      .eq('brand_id', brand.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // ── Register the regeneration (increments counter + deducts quota if needed)
    await registerRegeneration(id, brand.id);

    // ── Activity log ───────────────────────────────────────────────────────────
    await supabase.from('activity_log').insert({
      brand_id:    brand.id,
      user_id:     user.id,
      action:      'regenerate_post',
      entity_type: 'post',
      entity_id:   id,
      details:     {
        mode:            'copy',
        versionsCount:   prevVersions.length,
        regenCount:      check.regenerationCount + 1,
        costQuota:       check.willCostQuota,
      },
    }).catch(() => { /* non-critical */ });

    return NextResponse.json({
      post:          updated as Post,
      regenCount:    check.regenerationCount + 1,
      willCostQuota: check.willCostQuota,
      quotaAfter:    check.quotaAfter,
    });
  } catch (err) {
    return apiError(err, 'posts/[id]/regenerate');
  }
}
