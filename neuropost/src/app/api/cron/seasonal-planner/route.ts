import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { getUpcomingDatesForBrand, generateSeasonalContent } from '@/agents/SeasonalAgent';
import { normalizePreferences } from '@/lib/plan-features';
import type { Brand, BrandRules } from '@/types';

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET ?? ''}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = createAdminClient();

  const { data: allDates } = await db.from('seasonal_dates').select('*');
  const { data: brands }   = await db.from('brands').select('*');

  let postsCreated = 0;

  for (const brand of brands ?? []) {
    const b = brand as Brand;
    if (!b.sector) continue;

    const upcoming = getUpcomingDatesForBrand(allDates ?? [], b.sector, 35);

    for (const d of upcoming.slice(0, 5)) {
      // Check if post already exists for this date
      const start = new Date(d.nextOccurrence); start.setDate(start.getDate() - d.days_advance - 2);
      const end   = new Date(d.nextOccurrence); end.setDate(end.getDate() + 1);

      const { count } = await db.from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', b.id)
        .gte('scheduled_for', start.toISOString())
        .lte('scheduled_for', end.toISOString());

      if ((count ?? 0) > 0) continue;

      try {
        const rules = (b.rules ?? null) as BrandRules | null;
        const prefs = normalizePreferences(b.plan, rules?.preferences);
        const content = await generateSeasonalContent({
          fecha:            d.name,
          diasRestantes:    d.daysUntil,
          sector:           b.sector ?? 'otro',
          brandName:        b.name,
          brandVoiceDoc:    b.brand_voice_doc ?? `${b.name}, ${b.sector}`,
          previousYearPost: null,
          forbiddenWords:   rules?.forbiddenWords,
          forbiddenTopics:  rules?.forbiddenTopics,
          noEmojis:         rules?.noEmojis,
          likesCarousels:   prefs.likesCarousels,
          includeVideos:    prefs.includeVideos,
        });

        const publishDate = new Date(d.nextOccurrence);
        publishDate.setDate(publishDate.getDate() - (d.days_advance ?? 3));

        await db.from('posts').insert({
          brand_id:      b.id,
          caption:       content.caption,
          hashtags:      content.hashtags,
          status:        b.publish_mode === 'auto' ? 'pending' : 'draft',
          goal:          'awareness',
          scheduled_for: publishDate.toISOString(),
          metadata:      { source: 'seasonal', seasonal_date: d.name },
        });

        await db.from('notifications').insert({
          brand_id: b.id,
          type:     'approval_needed',
          message:  `📅 Post de "${d.name}" listo para revisar`,
        });

        postsCreated++;
      } catch { /* continue */ }
    }
  }

  return NextResponse.json({ ok: true, postsCreated });
}
