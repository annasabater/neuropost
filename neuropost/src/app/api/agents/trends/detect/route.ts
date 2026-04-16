import { NextResponse } from 'next/server';
import { rateLimitAgents } from '@/lib/ratelimit';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { detectTrendsBySector } from '@/agents/TrendsAgent';

export async function POST(request: Request) {
  try {
    const rl = await rateLimitAgents(request);
    if (rl) return rl;
    await requireServerUser();
    const { sector, ciudad } = await request.json() as { sector: string; ciudad?: string };

    const weekOf = new Date();
    weekOf.setDate(weekOf.getDate() - weekOf.getDay() + 1); // Monday
    const weekStr = weekOf.toISOString().split('T')[0];

    const result = await detectTrendsBySector(sector, ciudad ?? 'España', weekStr);

    // Save trends to DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createServerClient() as any;
    const saved = await Promise.all(
      result.trends.map(t =>
        supabase.from('trends').insert({
          sector,
          title:       t.title,
          format:      t.format,
          description: t.description,
          viral_score: t.viralScore,
          expires_in:  t.expiresIn,
          hashtags:    t.hashtags,
          week_of:     weekStr,
        }).select().single(),
      ),
    );

    const trendRows = saved.map((r: { data: unknown }) => r.data).filter(Boolean);

    return NextResponse.json({ trends: trendRows, weekSummary: result.weekSummary });
  } catch (err) {
    return apiError(err, 'POST /api/agents/trends/detect');
  }
}
