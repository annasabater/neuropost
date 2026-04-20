'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { createBrowserClient } from '@/lib/supabase';

function EyeIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6A3 3 0 0013.4 13.4" />
      <path d="M9.9 5.1A10.9 10.9 0 0112 5c6.5 0 10 7 10 7a17.8 17.8 0 01-4.1 5.2" />
      <path d="M6.6 6.6A17.3 17.3 0 002 12s3.5 7 10 7a10.9 10.9 0 005.1-1.3" />
    </svg>
  );
}

function LoginForm() {
  const [loading, setLoading]   = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const emailRef                = useRef<HTMLInputElement>(null);
  const passwordRef             = useRef<HTMLInputElement>(null);
  const router                  = useRouter();
  const searchParams            = useSearchParams();
  const t                       = useTranslations('auth.login');

  // Pre-fill email if redirected from /register with ?email=...
  useEffect(() => {
    const email = searchParams.get('email');
    if (email && emailRef.current) emailRef.current.value = email;
  }, [searchParams]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email:    emailRef.current!.value,
      password: passwordRef.current!.value,
    });
    if (error) { setLoading(false); toast.error(error.message); return; }

    setLoading(false);
    setVerifying(true);

    // 1. Check if user is a worker (admin/senior/worker) → redirect to worker portal
    try {
      const workerRes = await fetch('/api/worker/me');
      if (workerRes.ok) {
        const { worker } = await workerRes.json();
        if (worker?.is_active) {
          router.push('/worker');
          return;
        }
      }
    } catch { /* not a worker, continue */ }

    // 2. Regular user: brand → dashboard, no brand → onboarding
    const { data: brand } = await supabase
      .from('brands')
      .select('id')
      .eq('user_id', data.user.id)
      .maybeSingle();

    router.push(brand ? '/dashboard' : '/onboarding');
  }

  if (verifying) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <Link href="/" className="auth-logo">NeuroPost</Link>
          <span className="loading-spinner" style={{ display: 'inline-block', margin: '24px auto 16px' }} />
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', fontFamily: "var(--font-barlow), sans-serif" }}>
            Verificando tu cuenta…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-logo">NeuroPost</Link>
        <h1 className="auth-title auth-title-lg">{t('title')}</h1>
        <p className="auth-sub">{t('subtitle')}</p>
        <form onSubmit={handleLogin} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">{t('email')}</label>
            <input ref={emailRef} id="email" type="email" placeholder="tu@email.com" required autoComplete="email" />
          </div>
          <div className="form-group">
            <label htmlFor="password">{t('password')}</label>
            <div className="auth-password-wrap">
              <input
                ref={passwordRef}
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="auth-password-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="auth-password-toggle"
                aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
              >
                <EyeIcon visible={showPassword} />
              </button>
            </div>
          </div>
          <button type="submit" className="btn-primary btn-full" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? <><span className="loading-spinner" />{t('loading')}</> : t('submit')}
          </button>
        </form>
        <p className="auth-footer">
          <Link href="/forgot-password" style={{ color: 'var(--muted)' }}>{t('forgotPassword')}</Link>
        </p>
        <p className="auth-footer">
          {t('noAccount')}{' '}
          <Link href="/register">{t('register')}</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
