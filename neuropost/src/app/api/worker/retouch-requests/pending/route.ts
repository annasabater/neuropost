import { NextResponse }  from 'next/server';
import { requireWorker } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';
import { apiError }      from '@/lib/api-utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function GET() {
  try {
    await requireWorker();
    const db = createAdminClient() as DB;

    const { data, error } = await db
      .from('retouch_requests')
      .select(`
        *,
        brands ( name ),
        posts ( caption, image_url ),
        weekly_plans ( week_start )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) throw error;

    const requests = (data ?? []).map((r: Record<string, unknown>) => ({
      ...r,
      brand_name:     (r.brands as { name: string } | null)?.name   ?? '',
      post_caption:   (r.posts  as { caption: string | null } | null)?.caption   ?? '',
      post_image_url: (r.posts  as { image_url: string | null } | null)?.image_url ?? null,
      week_start:     (r.weekly_plans as { week_start: string } | null)?.week_start ?? '',
      brands:         undefined,
      posts:          undefined,
      weekly_plans:   undefined,
    }));

    return NextResponse.json({ requests });
  } catch (err) {
    return apiError(err, 'GET /api/worker/retouch-requests/pending');
  }
}
