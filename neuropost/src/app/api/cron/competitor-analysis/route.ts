import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { fetchCompetitorPublicData, analyzeCompetitor } from '@/agents/CompetitorAgent';
import type { Brand } from '@/types';

export async function GET(request: Request) {
  const auth      = request.headers.get('authorization');
  const isVercel  = request.headers.get('x-vercel-cron') === '1';
  const secret    = process.env.CRON_SECRET ?? '';
  const validBearer = secret && auth === `Bearer ${secret}`;
  if (!isVercel && !validBearer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createAdminClient();

  // Only analyze Pro/Agency brands with competitors defined
  const { data: brands } = await db
    .from('brands')
    .select('*')
    .in('plan', ['pro', 'agency'])
    .not('competitors', 'eq', '{}');

  let analyses = 0;

  for (const brand of brands ?? []) {
    const b = brand as Brand & { competitors: string[] };
    const competitors = b.competitors ?? [];
    if (!competitors.length) continue;

    const accessToken = b.ig_access_token ?? b.fb_access_token;
    if (!accessToken) continue;

    for (const username of competitors.slice(0, 5)) {
      try {
        const { profile, posts } = await fetchCompetitorPublicData(username, accessToken);
        if (!profile && !posts.length) continue;

        const result = await analyzeCompetitor({
          competitorUsername: username,
          competitorBio:      profile?.biography ?? null,
          followersCount:     profile?.followers_count ?? 0,
          recentPosts:        posts,
          clientSector:       b.sector ?? 'otro',
          clientBrandVoice:   b.brand_voice_doc ?? `${b.name}, ${b.sector}`,
          clientName:         b.name,
        });

        await db.from('competitor_analysis').upsert({
          brand_id:            b.id,
          competitor_username: username,
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
        }, { onConflict: 'brand_id,competitor_username' });

        analyses++;
      } catch { /* continue */ }
    }

    if (analyses > 0) {
      await db.from('notifications').insert({
        brand_id: b.id,
        type:     'published',
        message:  '📊 Análisis semanal de tu competencia listo',
      });
    }
  }

  return NextResponse.json({ ok: true, analyses });
}
