'use client';

import { useEffect, useRef, useState } from 'react';
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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched]   = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

  // If Supabase sent the user here from an email confirmation link (either
  // because the dashboard Site URL is misconfigured or because the template
  // uses a hard-coded redirect), we forward them to the real callback so the
  // code gets exchanged for a session, or to /login if it's already a plain
  // "come back after confirming" redirect.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Query params: ?code=… means Supabase PKCE flow landed on the wrong
    //    page. Forward to /auth/callback preserving every parameter.
    const code       = params.get('code');
    const tokenHash  = params.get('token_hash');
    const type       = params.get('type');
    if (code || tokenHash) {
      const search = window.location.search; // keeps code/token_hash/type/next
      router.replace(`/auth/callback${search}`);
      return;
    }

    // 2. Implicit-flow hash: #access_token=…&type=signup|recovery. Supabase
    //    puts the tokens in the URL fragment and the server never sees it.
    //    Forward to a client-side bridge page that exchanges the hash.
    const hash = window.location.hash;
    if (hash && (hash.includes('access_token=') || hash.includes('type=signup') || hash.includes('type=recovery'))) {
      window.location.replace(`/auth/confirm${hash}`);
      return;
    }

    // 3. Plain "email confirmed" query (?type=signup without code) — the user
    //    already confirmed in Supabase's hosted page, so just send them to
    //    /login with a friendly toast.
    if (type === 'signup' || type === 'email_change') {
      toast.success('Cuenta confirmada. Inicia sesión para continuar.');
      router.replace('/login');
    }
  }, [params, router]);

  const passed   = RULES.filter((r) => r.test(password)).length;
  const level    = strengthLevel(passed);
  const allPass  = RULES.every((r) => r.test(password));
  const passwordsMatch = confirmPassword.length > 0 && confirmPassword === password;

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!allPass) { toast.error(t('passwordInvalid')); return; }
    if (confirmPassword !== password) { toast.error('Las contraseñas no coinciden'); return; }
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
        <h1 className="auth-title auth-title-lg">{t('titleAlt')}</h1>
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
            <div className="auth-password-wrap">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder={t('rules.min8')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched(true)}
                required
                autoComplete="new-password"
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

          {password.length > 0 && (
            <div className="form-group" style={{ marginBottom: 8 }}>
              <label htmlFor="confirmPassword">Repite tu contraseña</label>
              <div className="auth-password-wrap">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Vuelve a escribir tu contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onBlur={() => setConfirmTouched(true)}
                  required
                  autoComplete="new-password"
                  className="auth-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="auth-password-toggle"
                  aria-label={showConfirmPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                >
                  <EyeIcon visible={showConfirmPassword} />
                </button>
              </div>
              {confirmTouched && !passwordsMatch && (
                <p style={{ marginTop: 6, fontSize: '0.78rem', color: '#e53e3e' }}>
                  Las contraseñas no coinciden
                </p>
              )}
            </div>
          )}

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
            disabled={loading || (touched && !allPass) || (confirmTouched && !passwordsMatch)}
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
