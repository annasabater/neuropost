import { NextResponse } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    await requireWorker();
    const { brandId } = await params;
    const db = createAdminClient();

    const { data: brand, error: brandErr } = await db
      .from('brands')
      .select('*')
      .eq('id', brandId)
      .single();
    if (brandErr || !brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const [
      { data: posts },
      { data: queue },
      { data: activity },
      { data: notes },
    ] = await Promise.all([
      db.from('posts').select('*').eq('brand_id', brandId).order('created_at', { ascending: false }).limit(20),
      db.from('content_queue').select('*').eq('brand_id', brandId).order('created_at', { ascending: false }).limit(20),
      db.from('client_activity_log').select('*').eq('brand_id', brandId).order('created_at', { ascending: false }).limit(50),
      db.from('client_notes').select('*, workers(full_name, avatar_url)').eq('brand_id', brandId).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
    ]);

    return NextResponse.json({ brand, posts: posts ?? [], queue: queue ?? [], activity: activity ?? [], notes: notes ?? [] });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
