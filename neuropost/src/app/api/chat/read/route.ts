import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
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
    return apiError(err, 'chat/read');
  }
}
