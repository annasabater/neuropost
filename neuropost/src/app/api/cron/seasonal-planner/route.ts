import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { getUpcomingDatesForBrand, generateSeasonalContent } from '@/agents/SeasonalAgent';
import { normalizePreferences } from '@/lib/plan-features';
import { queueJob } from '@/lib/agents/queue';
import { notify } from '@/lib/notify';
import type { Brand, BrandRules } from '@/types';

export async function GET(request: Request) {
  const auth      = request.headers.get('authorization');
  const isVercel  = request.headers.get('x-vercel-cron') === '1';
  const secret    = process.env.CRON_SECRET ?? '';
  const validBearer = secret && auth === `Bearer ${secret}`;
  if (!isVercel && !validBearer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

        const { data: newPost } = await db.from('posts').insert({
          brand_id:      b.id,
          caption:       content.caption,
          hashtags:      content.hashtags,
          status:        b.publish_mode === 'auto' ? 'pending' : 'draft',
          goal:          'awareness',
          scheduled_for: publishDate.toISOString(),
          ai_explanation: JSON.stringify({ source: 'seasonal', seasonal_date: d.name, visual_idea: content.visualIdea }),
        }).select('id').single();

        // Auto-queue image generation for the seasonal post
        if (newPost?.id && content.visualIdea) {
          queueJob({
            brand_id:     b.id,
            agent_type:   'content',
            action:       'generate_image',
            input: {
              userPrompt:       content.visualIdea,
              sector:           b.sector ?? 'otro',
              visualStyle:      b.visual_style ?? 'warm',
              brandContext:     `${b.name} — ${b.sector}, contenido estacional: ${d.name}`,
              brandId:          b.id,
              format:           'post',
              _post_id:         newPost.id,
              _photo_index:     0,
              _original_prompt: content.visualIdea,
              _auto_pipeline:   true,
            },
            priority:     75,
            requested_by: 'cron',
          }).catch(() => null);
        }

        notify(b.id, 'approval_needed',
          `Post de "${d.name}" generado y en proceso. Imagen lista en unos minutos.`,
          { post_id: newPost?.id, seasonal_date: d.name },
        ).catch(() => null);

        postsCreated++;
      } catch { /* continue */ }
    }
  }

  return NextResponse.json({ ok: true, postsCreated });
}
