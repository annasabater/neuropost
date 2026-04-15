import { NextResponse } from 'next/server';
import { rateLimitAgents } from '@/lib/ratelimit';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { getUpcomingDatesForBrand } from '@/agents/SeasonalAgent';
import type { Brand } from '@/types';

export async function GET() {
  try {
    const user = await requireServerUser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createServerClient() as any;

    const { data: brand } = await supabase.from('brands').select('*').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const b = brand as Brand;

    const { data: allDates } = await supabase.from('seasonal_dates').select('*');
    const upcoming = getUpcomingDatesForBrand(allDates ?? [], b.sector ?? 'otro', 35);

    // For each upcoming date, check if a post already exists
    const upcomingWithStatus = await Promise.all(
      upcoming.slice(0, 10).map(async (d) => {
        const target = d.nextOccurrence;
        const start  = new Date(target); start.setDate(start.getDate() - d.days_advance - 2);
        const end    = new Date(target); end.setDate(end.getDate() + 1);

        const { data: posts } = await supabase
          .from('posts')
          .select('id,status')
          .eq('brand_id', b.id)
          .gte('scheduled_for', start.toISOString())
          .lte('scheduled_for', end.toISOString())
          .limit(1);

        return {
          ...d,
          nextOccurrence: target.toISOString(),
          hasPost:        (posts ?? []).length > 0,
          postId:         (posts ?? [])[0]?.id ?? null,
        };
      }),
    );

    return NextResponse.json({ upcoming: upcomingWithStatus });
  } catch (err) {
    return apiError(err, 'POST /api/agents/seasonal/upcoming');
  }
}
