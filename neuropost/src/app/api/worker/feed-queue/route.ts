import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function GET(request: Request) {
  try {
    const user     = await requireServerUser();
    const { searchParams } = new URL(request.url);
    const brandId  = searchParams.get('brandId');
    const supabase = await createServerClient() as DB;

    const { data: brand } = await supabase.from('brands').select('id').eq('user_id', user.id).single();
    const resolvedBrandId = brandId ?? brand?.id;
    if (!resolvedBrandId) return NextResponse.json({ queue: [] });

    const db = createAdminClient();
    const { data, error } = await db
      .from('feed_queue')
      .select('*, posts(id, image_url, edited_image_url, caption, status, scheduled_at)')
      .eq('brand_id', resolvedBrandId)
      .order('position', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ queue: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireServerUser();
    const body  = await request.json() as { items: { id: string; position: number; scheduled_at?: string }[] };
    const supabase = await createServerClient() as DB;

    const { data: brand } = await supabase.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const db = createAdminClient();
    await Promise.all(
      body.items.map((item) =>
        db.from('feed_queue').update({
          position:     item.position,
          ...(item.scheduled_at ? { scheduled_at: item.scheduled_at } : {}),
        }).eq('id', item.id).eq('brand_id', brand.id),
      ),
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
