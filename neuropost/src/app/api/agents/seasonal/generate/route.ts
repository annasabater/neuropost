import { NextResponse } from 'next/server';
import { rateLimitAgents } from '@/lib/ratelimit';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { generateSeasonalContent } from '@/agents/SeasonalAgent';
import { normalizePreferences } from '@/lib/plan-features';
import type { Brand, BrandRules } from '@/types';

export async function POST(request: Request) {
  try {
    const rl = await rateLimitAgents(request);
    if (rl) return rl;
    const user = await requireServerUser();
    const { seasonalDateId } = await request.json() as { seasonalDateId: string };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createServerClient() as any;

    const [{ data: brand }, { data: seasonalDate }] = await Promise.all([
      supabase.from('brands').select('*').eq('user_id', user.id).single(),
      supabase.from('seasonal_dates').select('*').eq('id', seasonalDateId).single(),
    ]);

    if (!brand)        return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    if (!seasonalDate) return NextResponse.json({ error: 'Seasonal date not found' }, { status: 404 });

    const b = brand as Brand;

    // Calculate days until
    const now    = new Date();
    const target = new Date(now.getFullYear(), (seasonalDate.month ?? 1) - 1, seasonalDate.day ?? 1);
    if (target < now) target.setFullYear(now.getFullYear() + 1);
    const diasRestantes = Math.ceil((target.getTime() - now.getTime()) / 86400000);

    // Check for previous year post about this date
    const lastYear = new Date(now.getFullYear() - 1, (seasonalDate.month ?? 1) - 1, seasonalDate.day ?? 1);
    const { data: previousPost } = await supabase
      .from('posts')
      .select('caption')
      .eq('brand_id', b.id)
      .ilike('caption', `%${seasonalDate.name}%`)
      .gte('published_at', new Date(lastYear.getTime() - 7 * 86400000).toISOString())
      .lte('published_at', new Date(lastYear.getTime() + 7 * 86400000).toISOString())
      .limit(1)
      .single();

    const rules = (b.rules ?? null) as BrandRules | null;
    const prefs = normalizePreferences(b.plan, rules?.preferences);

    const content = await generateSeasonalContent({
      fecha:            seasonalDate.name,
      diasRestantes,
      sector:           b.sector ?? 'otro',
      brandName:        b.name,
      brandVoiceDoc:    b.brand_voice_doc ?? `Negocio: ${b.name}, Sector: ${b.sector}, Tono: ${b.tone}`,
      previousYearPost: previousPost?.caption ?? null,
      forbiddenWords:   rules?.forbiddenWords,
      forbiddenTopics:  rules?.forbiddenTopics,
      noEmojis:         rules?.noEmojis,
      likesCarousels:   prefs.likesCarousels,
      includeVideos:    prefs.includeVideos,
    });

    // Publish date = days_advance before the actual date
    const publishDate = new Date(target);
    publishDate.setDate(publishDate.getDate() - (seasonalDate.days_advance ?? 3));

    // Create post as draft
    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        brand_id:      b.id,
        caption:       content.caption,
        hashtags:      content.hashtags,
        status:        'draft',
        goal:          'awareness',
        scheduled_for: publishDate.toISOString(),
        metadata:      { source: 'seasonal', seasonal_date: seasonalDate.name, visual_idea: content.visualIdea },
      })
      .select()
      .single();

    if (error) throw error;

    // Notify
    await supabase.from('notifications').insert({
      brand_id: b.id,
      type:     'published',
      message:  `📅 Post de ${seasonalDate.name} listo para revisar`,
      metadata: { post_id: post.id, seasonal_date: seasonalDate.name },
    });

    return NextResponse.json({ post, content });
  } catch (err) {
    return apiError(err, 'POST /api/agents/seasonal/generate');
  }
}
