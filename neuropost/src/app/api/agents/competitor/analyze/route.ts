import { NextResponse } from 'next/server';
import { rateLimitAgents } from '@/lib/ratelimit';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { fetchCompetitorPublicData, analyzeCompetitor } from '@/agents/CompetitorAgent';
import { checkFeature } from '@/lib/plan-limits';
import { normalizePreferences } from '@/lib/plan-features';
import type { Brand, BrandRules } from '@/types';

export async function POST(request: Request) {
  try {
    const rl = await rateLimitAgents(request);
    if (rl) return rl;
    const user = await requireServerUser();
    const { competitorUsername } = await request.json() as { competitorUsername: string };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createServerClient() as any;
    const { data: brand } = await supabase.from('brands').select('*').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const b = brand as Brand;

    // Plan gate — competitor analysis is a Total+ feature.
    const gate = await checkFeature(b.id, 'competitorAgent');
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.reason, upgradeUrl: gate.upgradeUrl }, { status: 402 });
    }

    // Need Meta access token to query IG Graph API
    const accessToken = b.ig_access_token ?? b.fb_access_token;
    if (!accessToken) {
      return NextResponse.json({ error: 'Conecta tu cuenta de Instagram primero' }, { status: 422 });
    }

    const { profile, posts } = await fetchCompetitorPublicData(competitorUsername, accessToken);

    const rules = (b.rules ?? null) as BrandRules | null;
    const prefs = normalizePreferences(b.plan, rules?.preferences);

    const result = await analyzeCompetitor({
      competitorUsername,
      competitorBio:    profile?.biography ?? null,
      followersCount:   profile?.followers_count ?? 0,
      recentPosts:      posts,
      clientSector:     b.sector ?? 'otro',
      clientBrandVoice: b.brand_voice_doc ?? `${b.name}, ${b.sector}, tono ${b.tone}`,
      clientName:       b.name,
      forbiddenWords:   rules?.forbiddenWords,
      forbiddenTopics:  rules?.forbiddenTopics,
      noEmojis:         rules?.noEmojis,
      likesCarousels:   prefs.likesCarousels,
      includeVideos:    prefs.includeVideos,
    });

    // Save analysis
    const { data: saved } = await supabase
      .from('competitor_analysis')
      .upsert({
        brand_id:            b.id,
        competitor_username: competitorUsername,
        followers_count:     profile?.followers_count ?? 0,
        avg_engagement:      result.competitorAnalysis.avgEngagement,
        top_formats:         result.competitorAnalysis.topFormats,
        top_topics:          result.competitorAnalysis.topTopics,
        posting_frequency:   result.competitorAnalysis.postingFrequency,
        strengths:           result.competitorAnalysis.strengths,
        weaknesses:          result.competitorAnalysis.weaknesses,
        opportunity_gaps:    result.opportunityGaps,
        content_ideas:       result.contentIdeas,
        analyzed_at:         new Date().toISOString(),
      }, { onConflict: 'brand_id,competitor_username' })
      .select()
      .single();

    return NextResponse.json({ analysis: saved, result });
  } catch (err) {
    return apiError(err, 'POST /api/agents/competitor/analyze');
  }
}
