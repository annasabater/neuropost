import { NextResponse }       from 'next/server';
import { requireServerUser }  from '@/lib/supabase';
import { createAdminClient }  from '@/lib/supabase';
import { apiError }           from '@/lib/api-utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user   = await requireServerUser();
    const { id } = await params;
    const db     = createAdminClient() as DB;

    // Load plan + ownership check
    const { data: plan } = await db
      .from('weekly_plans')
      .select('*, brands!inner ( name, user_id )')
      .eq('id', id)
      .single();

    if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 });
    if (plan.brands?.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Posts are linked via content_ideas.post_id (Sprint 6 bridge)
    const { data: ideas } = await db
      .from('content_ideas')
      .select('id, post_id, format, angle')
      .eq('week_id', id)
      .not('post_id', 'is', null);

    const postIds = (ideas ?? [])
      .map((i: { post_id: string }) => i.post_id)
      .filter(Boolean) as string[];

    if (postIds.length === 0) {
      return NextResponse.json({ plan, posts: [] });
    }

    // Load posts
    const { data: rawPosts } = await db
      .from('posts')
      .select('id, caption, image_url, format, scheduled_at, status, published_at, hashtags, client_retouched_at')
      .in('id', postIds)
      .order('scheduled_at', { ascending: true, nullsFirst: false });

    // Map content_idea_id onto each post
    const ideaByPost = Object.fromEntries(
      (ideas ?? []).map((i: { id: string; post_id: string }) => [i.post_id, i.id]),
    );

    // Check pending retouches
    const { data: pendingRetouches } = await db
      .from('retouch_requests')
      .select('post_id')
      .eq('week_id', id)
      .eq('status', 'pending');

    const pendingSet = new Set(
      (pendingRetouches ?? []).map((r: { post_id: string }) => r.post_id),
    );

    const posts = (rawPosts ?? []).map((p: Record<string, unknown>) => ({
      id:                 p.id,
      content_idea_id:    ideaByPost[p.id as string] ?? null,
      caption:            p.caption,
      image_url:          p.image_url,
      format:             p.format,
      scheduled_at:       p.scheduled_at,
      status:             p.status,
      hashtags:           p.hashtags,
      is_published:       p.published_at != null || p.status === 'published',
      has_pending_retouch: pendingSet.has(p.id as string),
    }));

    return NextResponse.json({ plan, posts });
  } catch (err) {
    return apiError(err, 'GET /api/client/weekly-plans/[id]/calendar');
  }
}
