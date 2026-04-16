import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const user = await requireServerUser();
    const db = createAdminClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const platform = searchParams.get('platform');
    const format = searchParams.get('format');
    const range = searchParams.get('range') ?? '3m';

    const { data: brand } = await db.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    let query = db.from('posts')
      .select('id, image_url, edited_image_url, caption, hashtags, status, platform, format, is_story, published_at, created_at, ig_post_id, fb_post_id')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') query = query.eq('status', status);
    if (platform && platform !== 'all') query = query.contains('platform', [platform]);
    if (format && format !== 'all') query = query.eq('format', format);

    if (range !== 'all') {
      const months = range === '1m' ? 1 : 3;
      const since = new Date();
      since.setMonth(since.getMonth() - months);
      query = query.gte('created_at', since.toISOString());
    }

    const { data: posts, error } = await query;
    if (error) throw error;

    const all = posts ?? [];
    const stats = {
      total: all.length,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      published: all.filter((p: any) => p.status === 'published').length,
      approvalRate: all.length > 0
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? Math.round((all.filter((p: any) => ['approved', 'published'].includes(p.status)).length / all.length) * 100)
        : 0,
    };

    return NextResponse.json({ posts: all, stats });
  } catch (err) {
    return apiError(err, 'historial');
  }
}
