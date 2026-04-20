import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

// Vercel Cron: runs every Monday at 00:00 UTC
// vercel.json: { "crons": [{ "path": "/api/cron/reset-weekly-counters", "schedule": "0 0 * * 1" }] }
export async function GET(request: Request) {
  const auth      = request.headers.get('authorization');
  const isVercel  = request.headers.get('x-vercel-cron') === '1';
  const secret    = process.env.CRON_SECRET ?? '';
  const validBearer = secret && auth === `Bearer ${secret}`;
  if (!isVercel && !validBearer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { error, count } = await supabase
    .from('brands')
    .update({
      posts_this_week:   0,
      stories_this_week: 0,
      videos_this_week:  0,
      week_reset_at:     new Date().toISOString(),
    })
    .neq('id', '00000000-0000-0000-0000-000000000000') // update all rows
    .select('id', { count: 'exact', head: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, brandsReset: count ?? 0 });
}
