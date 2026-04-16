// =============================================================================
// GET/POST /api/recurring-posts — recurring content templates
// =============================================================================
// Allows brands to set up content that auto-generates on a schedule.
// Examples: "Menu del dia" every Monday, "Rutina de la semana" every Wednesday.

import { NextResponse } from 'next/server';
import { apiError, parsePagination } from '@/lib/api-utils';
import { rateLimitWrite } from '@/lib/ratelimit';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function GET(request: Request) {
  try {
    const user = await requireServerUser();
    const db = createAdminClient() as DB;
    const { limit, offset } = parsePagination(request, 50, 20);

    const { data: brand } = await db.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { data, error } = await db
      .from('recurring_posts')
      .select('*')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;

    return NextResponse.json({ recurring_posts: data ?? [] });
  } catch (err) {
    return apiError(err, 'GET /api/recurring-posts');
  }
}

export async function POST(request: Request) {
  try {
    const rl = await rateLimitWrite(request);
    if (rl) return rl;

    const user = await requireServerUser();
    const db = createAdminClient() as DB;
    const body = await request.json();

    const { data: brand } = await db.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Título requerido' }, { status: 400 });
    }
    if (!body.frequency) {
      return NextResponse.json({ error: 'Frecuencia requerida' }, { status: 400 });
    }

    // Calculate next_scheduled_at based on frequency + day_of_week/day_of_month
    const nextScheduled = calculateNextSchedule(
      body.frequency,
      body.day_of_week ?? [],
      body.day_of_month ?? null,
      body.preferred_hour ?? 12,
    );

    const { data, error } = await db
      .from('recurring_posts')
      .insert({
        brand_id:          brand.id,
        title:             body.title.trim(),
        caption_template:  body.caption_template ?? null,
        hashtags:          body.hashtags ?? [],
        category_key:      body.category_key ?? null,
        format:            body.format ?? 'foto',
        image_prompt:      body.image_prompt ?? null,
        fixed_image_url:   body.fixed_image_url ?? null,
        frequency:         body.frequency,
        day_of_week:       body.day_of_week ?? null,
        day_of_month:      body.day_of_month ?? null,
        preferred_hour:    body.preferred_hour ?? 12,
        active:            true,
        auto_publish:      body.auto_publish ?? false,
        generate_image:    body.generate_image ?? true,
        generate_caption:  body.generate_caption ?? true,
        next_scheduled_at: nextScheduled,
        created_by:        user.id,
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ recurring_post: data }, { status: 201 });
  } catch (err) {
    return apiError(err, 'POST /api/recurring-posts');
  }
}

// ─── Scheduling logic ────────────────────────────────────────────────────────

function calculateNextSchedule(
  frequency: string,
  dayOfWeek: number[],
  dayOfMonth: number | null,
  preferredHour: number,
): string {
  const now = new Date();
  const today = now.getDay(); // 0=Sun

  if (frequency === 'daily') {
    // Next occurrence: tomorrow at preferred_hour (or today if hour hasn't passed)
    const next = new Date(now);
    if (now.getHours() >= preferredHour) {
      next.setDate(next.getDate() + 1);
    }
    next.setHours(preferredHour, 0, 0, 0);
    return next.toISOString();
  }

  if (frequency === 'weekly' || frequency === 'biweekly') {
    // Find next matching day_of_week
    const days = dayOfWeek.length > 0 ? dayOfWeek : [1]; // default Monday
    let minDaysAhead = 8;
    for (const dow of days) {
      let daysAhead = (dow - today + 7) % 7;
      if (daysAhead === 0 && now.getHours() >= preferredHour) daysAhead = 7;
      if (daysAhead === 0) daysAhead = 0; // today, hour not passed
      if (frequency === 'biweekly') daysAhead = daysAhead || 14;
      if (daysAhead < minDaysAhead) minDaysAhead = daysAhead;
    }
    const next = new Date(now);
    next.setDate(next.getDate() + minDaysAhead);
    next.setHours(preferredHour, 0, 0, 0);
    return next.toISOString();
  }

  if (frequency === 'monthly') {
    const dom = dayOfMonth ?? 1;
    const next = new Date(now);
    next.setDate(dom);
    next.setHours(preferredHour, 0, 0, 0);
    if (next <= now) {
      next.setMonth(next.getMonth() + 1);
    }
    return next.toISOString();
  }

  // Fallback: tomorrow
  const fallback = new Date(now);
  fallback.setDate(fallback.getDate() + 1);
  fallback.setHours(preferredHour, 0, 0, 0);
  return fallback.toISOString();
}
