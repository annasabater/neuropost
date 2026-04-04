import { NextResponse } from 'next/server';
import { createAdminClient, createServerClient } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=auth_callback', origin));
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(new URL('/login?error=auth_callback', origin));
  }

  const user = data.user;

  // Create profile if this is a new user (upsert is idempotent)
  const admin = createAdminClient();
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (!existingProfile) {
    // Extract name from user metadata (Google OAuth populates this)
    const fullName = user.user_metadata?.full_name
      ?? user.user_metadata?.name
      ?? user.email?.split('@')[0]
      ?? '';

    await admin.from('profiles').insert({
      id:        user.id,
      full_name: fullName,
      avatar_url: user.user_metadata?.avatar_url ?? null,
    });

    // Send welcome email
    try {
      const { sendWelcomeEmail } = await import('@/lib/email');
      if (user.email) {
        await sendWelcomeEmail(user.email, fullName);
      }
    } catch { /* email failure never blocks onboarding */ }

    // New user → go to onboarding
    return NextResponse.redirect(new URL('/onboarding', origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}
