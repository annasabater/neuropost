import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import type { Brand, Notification } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function GET() {
  try {
    const user     = await requireServerUser();
    const supabase = await createServerClient() as DB;

    const { data: brand } = await supabase
      .from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { data: notifications } = await supabase
      .from('notifications')
      .select('*')
      .eq('brand_id', (brand as Brand).id)
      .order('created_at', { ascending: false })
      .limit(50);

    return NextResponse.json({ notifications: (notifications as Notification[]) ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user     = await requireServerUser();
    const body     = await request.json() as { ids?: string[]; all?: boolean };
    const supabase = await createServerClient() as DB;

    const { data: brand } = await supabase
      .from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const brandId = (brand as Brand).id;
    let query = supabase.from('notifications').update({ read: true }).eq('brand_id', brandId);
    if (!body.all && body.ids?.length) {
      query = query.in('id', body.ids);
    }
    await query;

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
