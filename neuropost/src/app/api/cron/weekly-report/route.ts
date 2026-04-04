import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { sendWeeklyReportEmail } from '@/lib/email';
import type { Brand, Post } from '@/types';

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET ?? ''}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase  = createAdminClient();
  const weekAgo   = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  let emailsSent  = 0;

  // Get all brands
  const { data: brands } = await supabase
    .from('brands')
    .select('id,name,user_id,notify_email_comments');

  if (!brands?.length) return NextResponse.json({ sent: 0 });

  for (const rawBrand of brands) {
    const brand = rawBrand as Brand;

    // Get posts published this week
    const { data: posts } = await supabase
      .from('posts')
      .select('id,caption,metrics')
      .eq('brand_id', brand.id)
      .eq('status', 'published')
      .gte('published_at', weekAgo);

    const publishedPosts = (posts ?? []) as Post[];

    // Aggregate metrics
    let totalReach = 0;
    let totalLikes = 0;
    let topPost    = '';
    let topLikes   = 0;

    for (const p of publishedPosts) {
      const m = p.metrics ?? {};
      totalReach += (m.reach as number) ?? 0;
      totalLikes += (m.likes as number) ?? 0;
      if (((m.likes as number) ?? 0) > topLikes) {
        topLikes = (m.likes as number) ?? 0;
        topPost  = (p.caption ?? '').slice(0, 80);
      }
    }

    const engagementRate = totalReach > 0
      ? `${((totalLikes / totalReach) * 100).toFixed(1)}%`
      : '–';

    // Get user email
    const { data: authData } = await supabase.auth.admin.getUserById(brand.user_id);
    const email = authData?.user?.email;
    if (!email) continue;

    try {
      await sendWeeklyReportEmail(email, brand.name, {
        posts:      publishedPosts.length,
        reach:      totalReach,
        engagement: engagementRate,
        topPost:    topPost || undefined,
      });
      emailsSent++;
    } catch { /* non-blocking */ }
  }

  return NextResponse.json({ sent: emailsSent });
}
