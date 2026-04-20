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
  const admin = createAdminClient();

  // Check if profile exists
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (!existingProfile) {
    // New user — create profile and send welcome email
    const fullName = user.user_metadata?.full_name
      ?? user.user_metadata?.name
      ?? user.email?.split('@')[0]
      ?? '';

    await admin.from('profiles').insert({
      id:        user.id,
      full_name: fullName,
      avatar_url: user.user_metadata?.avatar_url ?? null,
    });

    try {
      const { sendWelcomeEmail } = await import('@/lib/email');
      if (user.email) {
        await sendWelcomeEmail(user.email, fullName);
      }
    } catch { /* email failure never blocks onboarding */ }

    // New user → always onboarding
    return NextResponse.redirect(new URL('/onboarding', origin));
  }

  // Existing user — check if they have a brand (onboarding completed)
  const { data: brand } = await admin
    .from('brands')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!brand) {
    // Has profile but no brand → needs onboarding
    return NextResponse.redirect(new URL('/onboarding', origin));
  }

  // Has profile + brand → go to dashboard (or next param)
  return NextResponse.redirect(new URL(next, origin));
}
