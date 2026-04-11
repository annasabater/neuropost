'use client';

// =============================================================================
// /auth/confirm — client-side bridge for implicit-flow email confirmations
// =============================================================================
//
// When Supabase is configured with the implicit (hash) flow, confirmation
// links redirect back to the Site URL with `#access_token=…&type=signup`.
// The fragment never reaches the server, so the existing /auth/callback
// route handler can't see it.
//
// This page runs on the client, reads the hash, sets the session via the
// Supabase browser client, and then sends the user to /onboarding (new
// brand) or /dashboard (existing brand). Errors go to /login with a flag.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';

export default function AuthConfirmPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'working' | 'error'>('working');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createBrowserClient();

      // Parse the hash fragment: #access_token=…&refresh_token=…&type=signup
      const hash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;
      const params = new URLSearchParams(hash);

      const accessToken  = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const type         = params.get('type');
      const errorDesc    = params.get('error_description');

      if (errorDesc) {
        if (!cancelled) {
          setStatus('error');
          router.replace(`/login?error=${encodeURIComponent(errorDesc)}`);
        }
        return;
      }

      // If we have tokens, set the session directly.
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token:  accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          if (!cancelled) {
            setStatus('error');
            router.replace('/login?error=auth_confirm');
          }
          return;
        }

        // Decide where to send the user based on whether they have a brand.
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          if (!cancelled) router.replace('/login');
          return;
        }

        // Password recovery flow: push them to reset-password so they can
        // set a new password while the session is active.
        if (type === 'recovery') {
          if (!cancelled) router.replace('/reset-password');
          return;
        }

        // Signup / email change: on first confirmation there's no brand yet,
        // so onboarding is the natural next step.
        const { data: brand } = await supabase
          .from('brands')
          .select('id')
          .eq('user_id', userData.user.id)
          .maybeSingle();

        if (!cancelled) {
          router.replace(brand ? '/dashboard' : '/onboarding');
        }
        return;
      }

      // No tokens in the hash and no error — just bounce to login.
      if (!cancelled) {
        router.replace('/login');
      }
    })();

    return () => { cancelled = true; };
  }, [router]);

  return (
    <div className="auth-page" style={{ padding: '80px 20px', textAlign: 'center' }}>
      <div className="auth-card" style={{ maxWidth: 420, margin: '0 auto' }}>
        <span className="loading-spinner" style={{ display: 'inline-block', marginBottom: 16 }} />
        <p style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 14, color: 'var(--muted)' }}>
          {status === 'working' ? 'Confirmando tu cuenta…' : 'Algo ha fallado. Redirigiendo…'}
        </p>
      </div>
    </div>
  );
}
