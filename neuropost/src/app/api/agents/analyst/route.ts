import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { brandToAgentContext } from '@/lib/agentContext';
import { runAnalystAgent } from '@neuropost/agents';
import type { AnalystInput, PostMetrics, AccountMetrics, CommunityMetrics, PlannerMetrics, Post, Brand } from '@/types';

export async function POST(request: Request) {
  try {
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

    const postMetrics: PostMetrics[] = posts.length
      ? posts.map((p) => ({
          postId:         p.id,
          contentPieceId: p.id,
          platform:       (Array.isArray(p.platform) ? p.platform[0] : p.platform) as 'instagram' | 'facebook',
          publishedAt:    p.published_at ?? p.created_at,
          reach:          Math.floor(Math.random() * 500 + 50),
          impressions:    Math.floor(Math.random() * 800 + 100),
          likes:          Math.floor(Math.random() * 60 + 5),
          comments:       Math.floor(Math.random() * 15 + 1),
          shares:         Math.floor(Math.random() * 10),
          saves:          Math.floor(Math.random() * 20 + 2),
          engagementRate: Math.random() * 6 + 1,
          captionPreview: p.caption?.slice(0, 60),
        }))
      : [
          { postId: 'demo-1', contentPieceId: 'demo-1', platform: 'instagram' as const, publishedAt: periodStart, reach: 340, impressions: 620, likes: 48, comments: 12, shares: 6, saves: 18, engagementRate: 5.2, captionPreview: 'Demo post' },
          { postId: 'demo-2', contentPieceId: 'demo-2', platform: 'facebook'  as const, publishedAt: periodStart, reach: 210, impressions: 380, likes: 22, comments: 5,  shares: 3, saves: 7,  engagementRate: 3.8, captionPreview: 'Demo post 2' },
        ];

    const accountMetrics: AccountMetrics[] = [
      { platform: 'instagram', followersStart: 800, followersEnd: 845, followersGained: 45, profileVisits: 180, websiteClicks: 22, totalReach: 2100, totalImpressions: 4200 },
      { platform: 'facebook',  followersStart: 320, followersEnd: 332, followersGained: 12, profileVisits: 65,  websiteClicks: 8,  totalReach: 890,  totalImpressions: 1600 },
    ];

    const communityMetrics: CommunityMetrics = {
      totalInteractions: 28,
      autoResponded:     18,
      escalated:         5,
      sentimentScore:    0.72,
      sentimentBreakdown: { positive: 15, neutral: 8, negative: 5 },
    };

    const published = posts.filter((p) => p.status === 'published').length;
    const plannerMetrics: PlannerMetrics = {
      plannedPosts:    12,
      publishedPosts:  published || 9,
      pendingApproval: posts.filter((p) => p.status === 'pending').length,
      rejected:        0,
      completionRate:  Math.round(((published || 9) / 12) * 100),
    };

    const input: AnalystInput = {
      period: { month: body.month, year: body.year },
      postMetrics,
      accountMetrics,
      communityMetrics,
      plannerMetrics,
    };

    const result = await runAnalystAgent(input, brandToAgentContext(typedBrand));
    if (!result.success) return NextResponse.json({ error: result.error?.message }, { status: 500 });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
