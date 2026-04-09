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
    const body  = await request.json() as {
      items: Array<{
        id: string;
        queueId?: string | null;
        postId?: string | null;
        imageUrl?: string | null;
        position: number;
        scheduledAt?: string | null;
        scheduled_at?: string | null;
      }>;
    };
    const supabase = await createServerClient() as DB;

    const { data: brand } = await supabase.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const db = createAdminClient();
    const { data: existingRows } = await db
      .from('feed_queue')
      .select('id,post_id')
      .eq('brand_id', brand.id)
      .eq('is_published', false);

    const rowsById = new Map<string, { id: string; post_id: string | null }>();
    const rowsByPostId = new Map<string, { id: string; post_id: string | null }>();
    for (const row of (existingRows ?? []) as Array<{ id: string; post_id: string | null }>) {
      rowsById.set(row.id, row);
      if (row.post_id) rowsByPostId.set(row.post_id, row);
    }

    await Promise.all(body.items.map(async (item) => {
      const existing = (item.queueId ? rowsById.get(item.queueId) : undefined)
        ?? rowsById.get(item.id)
        ?? (item.postId ? rowsByPostId.get(item.postId) : undefined);

      const payload = {
        position: item.position,
        scheduled_at: item.scheduledAt ?? item.scheduled_at ?? null,
      };

      if (existing) {
        await db
          .from('feed_queue')
          .update(payload)
          .eq('id', existing.id)
          .eq('brand_id', brand.id);
        return;
      }

      if (!item.postId) return;

      await db.from('feed_queue').insert({
        brand_id:     brand.id,
        post_id:      item.postId,
        image_url:    item.imageUrl ?? null,
        position:     item.position,
        is_published: false,
        scheduled_at: item.scheduledAt ?? item.scheduled_at ?? null,
      });
    }));

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
