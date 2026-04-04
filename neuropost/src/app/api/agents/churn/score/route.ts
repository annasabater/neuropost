import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { calculateChurnScore } from '@/agents/ChurnAgent';

export async function GET() {
  try {
    const user = await requireServerUser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createServerClient() as any;

    const { data: brand } = await supabase
      .from('brands')
      .select('id,last_login_at,last_post_published_at,plan,rejected_in_a_row,created_at')
      .eq('user_id', user.id)
      .single();

    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const now = Date.now();
    const daysSinceLogin     = brand.last_login_at     ? Math.floor((now - new Date(brand.last_login_at).getTime()) / 86400000)     : 999;
    const daysSincePublished = brand.last_post_published_at ? Math.floor((now - new Date(brand.last_post_published_at).getTime()) / 86400000) : 999;

    // Estimate plan usage
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const { count: postsThisMonth } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brand.id)
      .eq('status', 'published')
      .gte('published_at', monthStart.toISOString());

    const planLimit = brand.plan === 'starter' ? 3 : 999;
    const planUsagePct = planLimit === 999 ? 1 : Math.min((postsThisMonth ?? 0) / planLimit, 1);

    const { score, risk, reasons } = calculateChurnScore({
      daysSinceLogin,
      daysSincePublished,
      planUsagePct,
      rejectedInARow: brand.rejected_in_a_row ?? 0,
      engagementDropPct: 0,
    });

    return NextResponse.json({ score, risk, reasons });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
