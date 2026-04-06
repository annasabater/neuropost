'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth.forgotPassword');
  const emailRef        = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: emailRef.current!.value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error');
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-logo">NeuroPost</Link>
        <h1 className="auth-title">{t('title')}</h1>

        {sent ? (
          <>
            <p className="auth-sub" style={{ color: 'var(--ink)' }}>
              {t('sentMessage')}
            </p>
            <p className="auth-footer" style={{ marginTop: 24 }}>
              <Link href="/login">{t('backToLogin')}</Link>
            </p>
          </>
        ) : (
          <>
            <p className="auth-sub">{t('subtitle')}</p>
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="email">{t('email')}</label>
                <input ref={emailRef} id="email" type="email" placeholder="tu@email.com" required autoComplete="email" />
              </div>
              <button type="submit" className="btn-primary btn-full" disabled={loading} style={{ marginTop: 4 }}>
                {loading ? <><span className="loading-spinner" />{t('loading')}</> : t('submit')}
              </button>
            </form>
            <p className="auth-footer">
              <Link href="/login">{t('backToLogin')}</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
