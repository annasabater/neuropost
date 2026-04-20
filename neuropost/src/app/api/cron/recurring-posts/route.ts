// =============================================================================
// Cron: recurring-posts — generate posts from recurring templates
// =============================================================================
// Runs hourly. Checks recurring_posts where next_scheduled_at <= now AND active.
// For each match:
//   1. Creates a new post from the template
//   2. Optionally queues image generation + caption generation
//   3. Advances next_scheduled_at to the next occurrence
//   4. If auto_publish: sets status to 'approved' for the publish cron

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { queueJob } from '@/lib/agents/queue';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export const dynamic    = 'force-dynamic';
export const maxDuration = 30;

interface RecurringPost {
  id:               string;
  brand_id:         string;
  title:            string;
  caption_template: string | null;
  hashtags:         string[];
  category_key:     string | null;
  format:           string;
  image_prompt:     string | null;
  fixed_image_url:  string | null;
  frequency:        string;
  day_of_week:      number[] | null;
  day_of_month:     number | null;
  preferred_hour:   number;
  auto_publish:     boolean;
  generate_image:   boolean;
  generate_caption: boolean;
  total_generated:  number;
}

export async function GET(request: Request) {
  const auth      = request.headers.get('authorization');
  const isVercel  = request.headers.get('x-vercel-cron') === '1';
  const secret    = process.env.CRON_SECRET ?? '';
  const validBearer = secret && auth === `Bearer ${secret}`;
  if (!isVercel && !validBearer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createAdminClient() as DB;
  const now = new Date().toISOString();

  // Find all recurring posts that are due
  const { data: dueRecurring, error } = await db
    .from('recurring_posts')
    .select('*')
    .eq('active', true)
    .lte('next_scheduled_at', now)
    .order('next_scheduled_at', { ascending: true })
    .limit(50);

  if (error) {
    console.error('[recurring-posts] query error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const templates = (dueRecurring ?? []) as RecurringPost[];
  if (!templates.length) {
    return NextResponse.json({ ok: true, generated: 0 });
  }

  let generated = 0;

  for (const tmpl of templates) {
    try {
      // Render caption template with dynamic placeholders
      const caption = renderCaption(tmpl.caption_template, tmpl.title);

      // Determine post status
      const status = tmpl.auto_publish ? 'approved' : 'pending';

      // Create the post
      const { data: post, error: postErr } = await db
        .from('posts')
        .insert({
          brand_id:            tmpl.brand_id,
          caption,
          hashtags:            tmpl.hashtags ?? [],
          format:              tmpl.format ?? 'foto',
          status,
          image_url:           tmpl.fixed_image_url ?? null,
          strategy_category_key: tmpl.category_key ?? null,
          ai_explanation:      JSON.stringify({
            source:        'recurring',
            recurring_id:  tmpl.id,
            template_title: tmpl.title,
          }),
          created_by:          null, // system-generated
        })
        .select('id, brand_id')
        .single();

      if (postErr || !post) {
        console.error(`[recurring-posts] Failed to create post for ${tmpl.id}:`, postErr);
        continue;
      }

      // Queue image generation if enabled and no fixed image
      if (tmpl.generate_image && !tmpl.fixed_image_url) {
        const { data: brand } = await db
          .from('brands')
          .select('name, sector, visual_style')
          .eq('id', tmpl.brand_id)
          .single();

        await queueJob({
          brand_id:     tmpl.brand_id,
          agent_type:   'content',
          action:       'generate_image',
          input: {
            userPrompt:  tmpl.image_prompt ?? `${tmpl.title} para Instagram de ${brand?.name ?? 'negocio local'}`,
            sector:      brand?.sector ?? 'otro',
            visualStyle: brand?.visual_style ?? 'warm',
            brandContext: `${brand?.name ?? ''} — ${brand?.sector ?? ''}`,
            brandId:     tmpl.brand_id,
            format:      tmpl.format === 'story' ? 'story' : 'post',
            _post_id:    post.id,
            _photo_index: 0,
            _original_prompt: tmpl.image_prompt ?? tmpl.title,
            _auto_pipeline: tmpl.generate_caption,
          },
          priority:     70,
          requested_by: 'cron',
        });
      }

      // Queue caption generation if enabled (and no image gen pipeline will do it)
      if (tmpl.generate_caption && !tmpl.generate_image) {
        await queueJob({
          brand_id:     tmpl.brand_id,
          agent_type:   'content',
          action:       'generate_caption',
          input: {
            goal:        'engagement',
            topic:       tmpl.title,
            platforms:   ['instagram'],
            postContext: tmpl.title,
            brand_id:    tmpl.brand_id,
            _post_id:    post.id,
            _auto_pipeline: true,
          },
          priority:     65,
          requested_by: 'cron',
        });
      }

      // Update recurring post: advance next_scheduled_at + increment counter
      const nextScheduled = calculateNext(
        tmpl.frequency,
        tmpl.day_of_week ?? [],
        tmpl.day_of_month,
        tmpl.preferred_hour,
      );

      await db.from('recurring_posts').update({
        last_generated_at: now,
        next_scheduled_at: nextScheduled,
        total_generated:   (tmpl.total_generated ?? 0) + 1,
        updated_at:        now,
      }).eq('id', tmpl.id);

      generated++;
      console.log(`[recurring-posts] Generated post ${post.id} from template "${tmpl.title}"`);
    } catch (err) {
      console.error(`[recurring-posts] Error processing template ${tmpl.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, generated, total: templates.length });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderCaption(template: string | null, title: string): string {
  if (!template) return title;

  const now = new Date();
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  return template
    .replace(/\{\{title\}\}/gi, title)
    .replace(/\{\{date\}\}/gi, now.toLocaleDateString('es-ES'))
    .replace(/\{\{day\}\}/gi, dayNames[now.getDay()])
    .replace(/\{\{month\}\}/gi, monthNames[now.getMonth()])
    .replace(/\{\{year\}\}/gi, String(now.getFullYear()));
}

function calculateNext(
  frequency: string,
  dayOfWeek: number[],
  dayOfMonth: number | null,
  preferredHour: number,
): string {
  const now = new Date();

  if (frequency === 'daily') {
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    next.setHours(preferredHour, 0, 0, 0);
    return next.toISOString();
  }

  if (frequency === 'weekly') {
    const days = dayOfWeek.length > 0 ? dayOfWeek : [1];
    const today = now.getDay();
    let minDays = 8;
    for (const dow of days) {
      const ahead = ((dow - today + 7) % 7) || 7; // at least 1 day ahead
      if (ahead < minDays) minDays = ahead;
    }
    const next = new Date(now);
    next.setDate(next.getDate() + minDays);
    next.setHours(preferredHour, 0, 0, 0);
    return next.toISOString();
  }

  if (frequency === 'biweekly') {
    const days = dayOfWeek.length > 0 ? dayOfWeek : [1];
    const today = now.getDay();
    let minDays = 15;
    for (const dow of days) {
      const ahead = ((dow - today + 7) % 7) || 14;
      if (ahead < minDays) minDays = ahead;
    }
    const next = new Date(now);
    next.setDate(next.getDate() + minDays);
    next.setHours(preferredHour, 0, 0, 0);
    return next.toISOString();
  }

  if (frequency === 'monthly') {
    const dom = dayOfMonth ?? 1;
    const next = new Date(now);
    next.setMonth(next.getMonth() + 1);
    next.setDate(Math.min(dom, 28));
    next.setHours(preferredHour, 0, 0, 0);
    return next.toISOString();
  }

  // Fallback
  const fb = new Date(now);
  fb.setDate(fb.getDate() + 7);
  fb.setHours(preferredHour, 0, 0, 0);
  return fb.toISOString();
}
