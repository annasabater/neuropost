import { NextResponse } from 'next/server';
import { rateLimitAgents } from '@/lib/ratelimit';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { checkFeature } from '@/lib/plan-limits';

export async function GET(request: Request) {
  try {
    const user = await requireServerUser();
    const sp   = new URL(request.url).searchParams;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createServerClient() as any;

    const { data: brand } = await supabase.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    // Plan gate — trends agent is a Total+ feature.
    const gate = await checkFeature(brand.id, 'trendsAgent');
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.reason, upgradeUrl: gate.upgradeUrl, brandTrends: [] }, { status: 402 });
    }

    const { data: brandTrends } = await supabase
      .from('brand_trends')
      .select('*, trends(*)')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false })
      .limit(sp.get('latest') ? 1 : 50);

    return NextResponse.json({ brandTrends: brandTrends ?? [] });
  } catch (err) {
    return apiError(err, 'POST /api/agents/trends/adapt/list');
  }
}
