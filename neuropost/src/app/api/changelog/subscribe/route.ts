import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email?.includes('@')) return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
    const db = createAdminClient();
    // Reuse status_subscribers table for changelog too — same audience
    await db.from('status_subscribers').upsert({ email: email.toLowerCase().trim() }, { onConflict: 'email' });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
