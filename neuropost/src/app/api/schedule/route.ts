import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient, createAdminClient } from '@/lib/supabase';
import { syncPostIntoFeedQueue } from '@/lib/feedQueue';
import { isDayAllowed, weekdayLabel, schedulingRulesFrom } from '@/lib/scheduling';
import type { Post, BrandRules } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function POST(request: Request) {
  try {
    const user     = await requireServerUser();
    const { postId, scheduledAt } = await request.json() as { postId: string; scheduledAt: string };
    const supabase   = await createServerClient() as DB;

    // Verify post belongs to user's brand + load rules for scheduling validation
    const { data: brand } = await supabase
      .from('brands').select('id, plan, rules').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    // Fetch post and validate approved status
    const { data: postData } = await supabase
      .from('posts').select('status').eq('id', postId).eq('brand_id', brand.id).single();
    if (!postData) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    const post = postData as Pick<Post, 'status'>;
    if (post.status !== 'approved') {
      return NextResponse.json({ error: 'El post debe estar aprobado antes de programarlo' }, { status: 400 });
    }

    const scheduled = new Date(scheduledAt);
    if (isNaN(scheduled.getTime()) || scheduled <= new Date()) {
      return NextResponse.json({ error: 'scheduledAt must be a future date' }, { status: 400 });
    }

    // Brand-aware day check — reject noPublishDays and enforce preferredDays.
    const brandRules     = (brand.rules ?? null) as BrandRules | null;
    const schedulingRules = schedulingRulesFrom(brandRules, brandRules?.preferences, brand.plan);
    if (!isDayAllowed(scheduled, schedulingRules)) {
      return NextResponse.json({
        error: `El ${weekdayLabel(scheduled.getDay())} no está permitido por las reglas de publicación de tu marca.`,
      }, { status: 422 });
    }

    const { data, error } = await supabase
      .from('posts')
      .update({ status: 'scheduled', scheduled_at: scheduledAt })
      .eq('id', postId)
      .eq('brand_id', brand.id)
      .select()
      .single();

    if (error) throw error;
    await syncPostIntoFeedQueue(createAdminClient(), data as Post);
    return NextResponse.json({ ok: true, post: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
