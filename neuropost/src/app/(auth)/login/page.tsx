'use client';

import { useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { createBrowserClient } from '@/lib/supabase';

function LoginForm() {
  const [loading, setLoading]   = useState(false);
  const emailRef                = useRef<HTMLInputElement>(null);
  const passwordRef             = useRef<HTMLInputElement>(null);
  const router                  = useRouter();
  const searchParams            = useSearchParams();
  const redirectTo              = searchParams.get('redirectTo') || '/dashboard';
  const t                       = useTranslations('auth.login');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email:    emailRef.current!.value,
      password: passwordRef.current!.value,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    router.push(redirectTo);
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-logo">NeuroPost</Link>
        <h1 className="auth-title">{t('title')}</h1>
        <p className="auth-sub">{t('subtitle')}</p>
        <form onSubmit={handleLogin} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">{t('email')}</label>
            <input ref={emailRef} id="email" type="email" placeholder="tu@email.com" required autoComplete="email" />
          </div>
          <div className="form-group">
            <label htmlFor="password">{t('password')}</label>
            <input ref={passwordRef} id="password" type="password" placeholder="••••••••" required autoComplete="current-password" />
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

// useSearchParams() requires a Suspense boundary in Next.js App Router
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
