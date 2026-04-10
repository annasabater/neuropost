import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { checkFeature } from '@/lib/plan-limits';

export async function GET() {
  try {
    const user = await requireServerUser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createServerClient() as any;

    const { data: brand } = await supabase.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    // Plan gate — competitor agent is a Total+ feature.
    const gate = await checkFeature(brand.id, 'competitorAgent');
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.reason, upgradeUrl: gate.upgradeUrl, analyses: [] }, { status: 402 });
    }

    const { data: analyses } = await supabase
      .from('competitor_analysis')
      .select('*')
      .eq('brand_id', brand.id)
      .order('analyzed_at', { ascending: false });

    return NextResponse.json({ analyses: analyses ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
