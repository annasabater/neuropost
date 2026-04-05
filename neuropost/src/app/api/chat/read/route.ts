import { NextResponse } from 'next/server';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const user = await requireServerUser();
    const db = createAdminClient();
    const { brandId } = await request.json();

    const { data: brand } = await db.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    await db.from('chat_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('brand_id', brandId ?? brand.id)
      .eq('sender_type', 'worker')
      .is('read_at', null);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
