import { NextResponse } from 'next/server';
import { rateLimitAgents } from '@/lib/ratelimit';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { brandToAgentContext } from '@/lib/agentContext';
import { runAnalystAgent } from '@neuropost/agents';
import { getIGPostInsights } from '@/lib/meta';
import type { AnalystInput, PostMetrics, AccountMetrics, CommunityMetrics, PlannerMetrics, Post, Brand } from '@/types';

export async function POST(request: Request) {
  try {
    const rl = await rateLimitAgents(request);
    if (rl) return rl;
    const user     = await requireServerUser();
    const body     = await request.json() as { month: number; year: number };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createServerClient() as any;

    const { data: brand } = await supabase
      .from('brands').select('*').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const typedBrand = brand as Brand;

    const periodStart = `${body.year}-${String(body.month).padStart(2, '0')}-01`;
    const nextMonth   = body.month === 12 ? 1 : body.month + 1;
    const nextYear    = body.month === 12 ? body.year + 1 : body.year;
    const periodEnd   = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const { data: dbPosts } = await supabase
      .from('posts')
      .select('*')
      .eq('brand_id', typedBrand.id)
      .gte('created_at', periodStart)
      .lt('created_at', periodEnd);

    const posts = (dbPosts ?? []) as Post[];

    // ── Fetch real post metrics from Meta (or use cached metrics field) ──────
    const postMetrics: PostMetrics[] = await Promise.all(
      posts
        .filter((p) => p.status === 'published')
        .map(async (p): Promise<PostMetrics> => {
          // Use cached metrics if available, otherwise fetch from Meta
          let m = p.metrics as Record<string, number> | null;

          if (!m && p.ig_post_id && typedBrand.ig_access_token) {
            try {
              const insights = await getIGPostInsights(p.ig_post_id, typedBrand.ig_access_token);
              m = {
                impressions: insights.impressions,
                reach:       insights.reach,
                likes:       insights.likes,
                comments:    insights.comments,
                saved:       insights.saved,
                shares:      insights.shares,
              };
              // Cache back to DB for future requests
              await supabase.from('posts').update({ metrics: m }).eq('id', p.id);
            } catch {
              m = null;
            }
          }

          const likes        = m?.likes        ?? m?.likes_count ?? 0;
          const comments     = m?.comments      ?? m?.comments_count ?? 0;
          const reach        = m?.reach         ?? 0;
          const impressions  = m?.impressions   ?? 0;
          const shares       = m?.shares        ?? 0;
          const saves        = m?.saved         ?? m?.saves ?? 0;
          const engagementRate = reach > 0
            ? ((likes + comments + shares + saves) / reach) * 100
            : 0;

          return {
            postId:         p.id,
            contentPieceId: p.id,
            platform:       'instagram' as const,
            publishedAt:    p.published_at ?? p.created_at,
            reach,
            impressions,
            likes,
            comments,
            shares,
            saves,
            engagementRate: Math.round(engagementRate * 100) / 100,
            captionPreview: p.caption?.slice(0, 60),
          };
        }),
    );

    // ── Account-level metrics from stored posts (approximated from post data) ─
    // TODO [FASE 2]: Facebook — add facebook account metrics when fb_page_id is present
    const accountMetrics: AccountMetrics[] = [
      ...(typedBrand.ig_account_id ? [{
        platform:         'instagram' as const,
        followersStart:   0,
        followersEnd:     0,
        followersGained:  0,
        profileVisits:    0,
        websiteClicks:    0,
        totalReach:       postMetrics.reduce((s, p) => s + p.reach, 0),
        totalImpressions: postMetrics.reduce((s, p) => s + p.impressions, 0),
      }] : []),
    ];

    // ── Community metrics from comments table ────────────────────────────────
    const { data: comments } = await supabase
      .from('comments')
      .select('sentiment, auto_replied')
      .eq('brand_id', typedBrand.id)
      .gte('created_at', periodStart)
      .lt('created_at', periodEnd);

    const commentRows = (comments ?? []) as { sentiment: string; auto_replied: boolean }[];
    const communityMetrics: CommunityMetrics = {
      totalInteractions: commentRows.length,
      autoResponded:     commentRows.filter((c) => c.auto_replied).length,
      escalated:         commentRows.filter((c) => c.sentiment === 'negative').length,
      sentimentScore:    commentRows.length > 0
        ? commentRows.filter((c) => c.sentiment === 'positive').length / commentRows.length
        : 0,
      sentimentBreakdown: {
        positive: commentRows.filter((c) => c.sentiment === 'positive').length,
        neutral:  commentRows.filter((c) => c.sentiment === 'neutral').length,
        negative: commentRows.filter((c) => c.sentiment === 'negative').length,
      },
    };

    // ── Planner metrics ──────────────────────────────────────────────────────
    const published      = posts.filter((p) => p.status === 'published').length;
    const plannedPosts   = posts.filter((p) => ['published', 'scheduled', 'pending', 'approved'].includes(p.status)).length;
    const plannerMetrics: PlannerMetrics = {
      plannedPosts:    plannedPosts || published,
      publishedPosts:  published,
      pendingApproval: posts.filter((p) => p.status === 'pending').length,
      rejected:        posts.filter((p) => p.status === 'cancelled').length,
      completionRate:  plannedPosts > 0 ? Math.round((published / plannedPosts) * 100) : 0,
    };

    // If there are no published posts this month, the analyst agent would
    // throw "postMetrics cannot be empty". Instead we return a structured
    // empty-state response so the UI can show a friendly message.
    if (posts.length === 0 && postMetrics.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          summary: `No hay posts publicados en ${body.month}/${body.year}. Publica tu primer contenido para empezar a ver tus analíticas.`,
          insights: [],
          recommendations: [
            { action: 'Publica tu primer post este mes para empezar a generar datos de rendimiento.', priority: 'high', estimatedImpact: 'Sin datos no es posible analizar el rendimiento.' },
          ],
          postMetrics: [],
          accountMetrics,
          communityMetrics,
          plannerMetrics,
          period: { month: body.month, year: body.year },
        },
      });
    }

    const input: AnalystInput = {
      period: { month: body.month, year: body.year },
      postMetrics:     postMetrics.length ? postMetrics : [],
      accountMetrics,
      communityMetrics,
      plannerMetrics,
    };

    const result = await runAnalystAgent(input, brandToAgentContext(typedBrand));
    if (!result.success) return NextResponse.json({ error: 'Error al procesar la solicitud' }, { status: 500 });
    return NextResponse.json(result);
  } catch (err) {
    return apiError(err, 'POST /api/agents/analyst');
  }
}
