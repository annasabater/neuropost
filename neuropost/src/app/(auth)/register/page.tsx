'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { createBrowserClient } from '@/lib/supabase';

type Rule = { label: string; test: (p: string) => boolean };

const RULES: Rule[] = [
  { label: 'Mínimo 8 caracteres',          test: (p) => p.length >= 8 },
  { label: '1 letra mayúscula',             test: (p) => /[A-Z]/.test(p) },
  { label: '1 letra minúscula',             test: (p) => /[a-z]/.test(p) },
  { label: '1 número',                      test: (p) => /[0-9]/.test(p) },
  { label: '1 carácter especial (!@#$…)',   test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function strengthLevel(password: string): 0 | 1 | 2 | 3 {
  const passed = RULES.filter((r) => r.test(password)).length;
  if (passed <= 1) return 0;
  if (passed <= 2) return 1;
  if (passed <= 4) return 2;
  return 3;
}

const STRENGTH_LABELS = ['Muy débil', 'Débil', 'Buena', 'Fuerte'];
const STRENGTH_COLORS = ['#e53e3e', '#ed8936', '#ecc94b', '#1a7a4a'];

export default function RegisterPage() {
  const [loading, setLoading]   = useState(false);
  const [password, setPassword] = useState('');
  const [touched, setTouched]   = useState(false);
  const emailRef  = useRef<HTMLInputElement>(null);
  const router    = useRouter();
  const params    = useSearchParams();

  useEffect(() => {
    const email = params.get('email');
    if (email && emailRef.current) emailRef.current.value = email;
  }, [params]);

  const level   = strengthLevel(password);
  const allPass = RULES.every((r) => r.test(password));

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!allPass) { toast.error('La contraseña no cumple los requisitos.'); return; }
    setLoading(true);
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signUp({
      email:    emailRef.current!.value,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success('¡Revisa tu email para confirmar tu cuenta!');
    router.push('/login');
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-logo">NeuroPost</Link>
        <h1 className="auth-title">Crea tu cuenta</h1>
        <p className="auth-sub">Empieza gratis. Sin tarjeta de crédito.</p>
        <form onSubmit={handleRegister} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Correo electrónico</label>
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
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              placeholder="Mín. 8 caracteres"
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
              ? <><span className="loading-spinner" />Creando cuenta...</>
              : 'Crear cuenta gratis'}
          </button>
        </form>
        <p className="auth-footer">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login">Entra aquí</Link>
        </p>
      </div>
    </div>
  );
}
