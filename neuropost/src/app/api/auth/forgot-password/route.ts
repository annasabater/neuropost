import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { email } = await request.json() as { email: string };
    if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 });

    const supabase = createAdminClient();
    const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/reset-password`,
    });

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
