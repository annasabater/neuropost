import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { detectTrendsBySector, adaptTrendToBrand } from '@/agents/TrendsAgent';
import { normalizePreferences } from '@/lib/plan-features';
import type { Brand, BrandRules } from '@/types';

const SECTORS = ['heladeria', 'restaurante', 'cafeteria', 'gym', 'clinica', 'barberia', 'boutique'];

export async function GET(request: Request) {
  const auth      = request.headers.get('authorization');
  const isVercel  = request.headers.get('x-vercel-cron') === '1';
  const secret    = process.env.CRON_SECRET ?? '';
  const validBearer = secret && auth === `Bearer ${secret}`;
  if (!isVercel && !validBearer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createAdminClient();

  const weekOf = new Date();
  weekOf.setDate(weekOf.getDate() - weekOf.getDay() + 1);
  const weekStr = weekOf.toISOString().split('T')[0];

  let trendsDetected = 0;
  let adaptations    = 0;

  // Detect trends for each sector
  for (const sector of SECTORS) {
    try {
      const result = await detectTrendsBySector(sector, 'España', weekStr);

      const savedTrends = await Promise.all(
        result.trends.map(t =>
          db.from('trends').insert({
            sector,
            title:       t.title,
            format:      t.format,
            description: t.description,
            viral_score: t.viralScore,
            expires_in:  t.expiresIn,
            hashtags:    t.hashtags,
            week_of:     weekStr,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }).select().single().then((r: any) => r.data),
        ),
      );

      trendsDetected += savedTrends.filter(Boolean).length;

      // Adapt to brands in this sector whose plan includes trendsAgent (Total only).
      const { data: brands } = await db
        .from('brands')
        .select('*')
        .eq('sector', sector)
        .in('plan', ['total']);

      for (const brand of brands ?? []) {
        const b = brand as Brand;
        const highUrgencyTrends = (result.trends ?? []).filter(t => t.viralScore >= 75);

        // Hydrate rules + preferences so the agent respects forbidden words,
        // noEmojis and the user's format preferences (carousels, videos).
        const rules = (b.rules ?? null) as BrandRules | null;
        const prefs = normalizePreferences(b.plan, rules?.preferences);

        for (const trend of highUrgencyTrends.slice(0, 2)) {
          try {
            const { data: recentPosts } = await db
              .from('posts').select('caption').eq('brand_id', b.id)
              .order('created_at', { ascending: false }).limit(5);

            const adapted = await adaptTrendToBrand({
              trend,
              brandVoiceDoc:   b.brand_voice_doc ?? `${b.name}, ${b.sector}, tono ${b.tone}`,
              sector:          b.sector ?? 'otro',
              tone:            b.tone   ?? 'cercano',
              recentPosts:     (recentPosts ?? []).map((p: { caption: string }) => p.caption ?? ''),
              forbiddenWords:  rules?.forbiddenWords,
              forbiddenTopics: rules?.forbiddenTopics,
              noEmojis:        rules?.noEmojis,
              likesCarousels:  prefs.likesCarousels,
              includeVideos:   prefs.includeVideos,
            });

            const trendId = savedTrends.find(t => (t as { title?: string })?.title === trend.title) as { id?: string } | null;

            await db.from('brand_trends').insert({
              brand_id:            b.id,
              trend_id:            trendId?.id ?? null,
              adapted_caption:     adapted.caption,
              adapted_hashtags:    adapted.hashtags,
              visual_instructions: adapted.visualInstructions,
              urgency:             adapted.urgency,
              status:              'suggested',
            });

            if (adapted.urgency === 'alta') {
              await db.from('notifications').insert({
                brand_id: b.id,
                type:     'trend_detected',
                message:  `🔥 Tendencia viral adaptada: ${adapted.adaptedTitle}`,
              });
            }

            adaptations++;
          } catch { /* continue */ }
        }
      }
    } catch { /* continue with next sector */ }
  }

  return NextResponse.json({ ok: true, trendsDetected, adaptations, weekOf: weekStr });
}
