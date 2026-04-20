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

  const sentEmail = emailRef.current?.value ?? '';

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-logo">NeuroPost</Link>
        <h1 className="auth-title">{t('title')}</h1>

        {sent ? (
          <>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '24px 0 8px', gap: 12,
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p style={{ fontFamily: "var(--font-barlow), sans-serif", fontSize: 15, color: 'var(--text-primary)', textAlign: 'center', fontWeight: 600 }}>
                Email enviado
              </p>
              {sentEmail && (
                <p style={{ fontFamily: "var(--font-barlow), sans-serif", fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
                  Revisa <strong>{sentEmail}</strong>
                </p>
              )}
              <p style={{ fontFamily: "var(--font-barlow), sans-serif", fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.6 }}>
                Si no lo ves en bandeja de entrada, revisa la carpeta de spam.
              </p>
            </div>
            <p className="auth-footer" style={{ marginTop: 16 }}>
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
