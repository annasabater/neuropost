'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { createBrowserClient } from '@/lib/supabase';

type Rule = { label: string; test: (p: string) => boolean };

const STRENGTH_COLORS = ['#e53e3e', '#ed8936', '#ecc94b', '#1a7a4a'];

function strengthLevel(passed: number): 0 | 1 | 2 | 3 {
  if (passed <= 1) return 0;
  if (passed <= 2) return 1;
  if (passed <= 4) return 2;
  return 3;
}

export default function RegisterPage() {
  const t = useTranslations('auth.register');
  const [loading, setLoading]   = useState(false);
  const [password, setPassword] = useState('');
  const [touched, setTouched]   = useState(false);
  const emailRef  = useRef<HTMLInputElement>(null);
  const router    = useRouter();
  const params    = useSearchParams();

  const RULES: Rule[] = [
    { label: t('rules.min8'),      test: (p) => p.length >= 8 },
    { label: t('rules.uppercase'), test: (p) => /[A-Z]/.test(p) },
    { label: t('rules.lowercase'), test: (p) => /[a-z]/.test(p) },
    { label: t('rules.number'),    test: (p) => /[0-9]/.test(p) },
    { label: t('rules.special'),   test: (p) => /[^A-Za-z0-9]/.test(p) },
  ];

  const STRENGTH_LABELS = [t('strength.weak'), t('strength.fair'), t('strength.good'), t('strength.strong')];

  useEffect(() => {
    const email = params.get('email');
    if (email && emailRef.current) emailRef.current.value = email;
  }, [params]);

  const passed   = RULES.filter((r) => r.test(password)).length;
  const level    = strengthLevel(passed);
  const allPass  = RULES.every((r) => r.test(password));

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!allPass) { toast.error(t('passwordInvalid')); return; }
    setLoading(true);
    const supabase = createBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email:    emailRef.current!.value,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }

    // If session exists, user is auto-confirmed → go straight to onboarding
    if (data.session) {
      router.push('/onboarding');
    } else {
      // Email confirmation required → tell user to check inbox
      toast.success(t('checkEmail'));
      router.push('/login');
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-logo">NeuroPost</Link>
        <h1 className="auth-title">{t('titleAlt')}</h1>
        <p className="auth-sub">{t('subtitleAlt')}</p>
        <form onSubmit={handleRegister} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">{t('email')}</label>
            <input
              ref={emailRef}
              id="email"
              type="email"
              placeholder="tu@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 8 }}>
            <label htmlFor="password">{t('password')}</label>
            <input
              id="password"
              type="password"
              placeholder={t('rules.min8')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched(true)}
              required
              autoComplete="new-password"
            />
          </div>

          {/* Strength bar — only shown once the user starts typing */}
          {password.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {/* Bar */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 4,
                  marginBottom: 6,
                }}
              >
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      height: 4,
                      borderRadius: 4,
                      background: i <= level ? STRENGTH_COLORS[level] : 'var(--border)',
                      transition: 'background 0.25s',
                    }}
                  />
                ))}
              </div>

              {/* Label */}
              <p style={{ fontSize: '0.78rem', fontWeight: 600, color: STRENGTH_COLORS[level], marginBottom: 8 }}>
                {STRENGTH_LABELS[level]}
              </p>

              {/* Rule checklist */}
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {RULES.map((rule) => {
                  const ok = rule.test(password);
                  return (
                    <li
                      key={rule.label}
                      style={{
                        fontSize: '0.78rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        color: ok ? 'var(--green)' : touched ? '#e53e3e' : 'var(--muted)',
                        transition: 'color 0.2s',
                      }}
                    >
                      <span style={{ fontSize: '0.7rem' }}>{ok ? '✓' : '✕'}</span>
                      {rule.label}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <button
            type="submit"
            className="btn-primary btn-full"
            disabled={loading || (touched && !allPass)}
            style={{ marginTop: 4 }}
          >
            {loading
              ? <><span className="loading-spinner" />{t('creating')}</>
              : t('createFree')}
          </button>
        </form>
        <p className="auth-footer">
          {t('hasAccount')}{' '}
          <Link href="/login">{t('login')}</Link>
        </p>
      </div>
    </div>
  );
}
