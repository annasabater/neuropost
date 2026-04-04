'use client';

import { useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { createBrowserClient } from '@/lib/supabase';

function LoginForm() {
  const [loading, setLoading]   = useState(false);
  const emailRef                = useRef<HTMLInputElement>(null);
  const passwordRef             = useRef<HTMLInputElement>(null);
  const router                  = useRouter();
  const searchParams            = useSearchParams();
  const redirectTo              = searchParams.get('redirectTo') || '/dashboard';

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
        <h1 className="auth-title">Bienvenido de vuelta</h1>
        <p className="auth-sub">Entra a tu cuenta para continuar</p>
        <form onSubmit={handleLogin} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Correo electrónico</label>
            <input ref={emailRef} id="email" type="email" placeholder="tu@email.com" required autoComplete="email" />
          </div>
          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input ref={passwordRef} id="password" type="password" placeholder="••••••••" required autoComplete="current-password" />
          </div>
          <button type="submit" className="btn-primary btn-full" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? <><span className="loading-spinner" />Entrando...</> : 'Entrar'}
          </button>
        </form>
        <p className="auth-footer">
          <Link href="/forgot-password" style={{ color: 'var(--muted)' }}>¿Olvidaste tu contraseña?</Link>
        </p>
        <p className="auth-footer">
          ¿No tienes cuenta?{' '}
          <Link href="/register">Regístrate gratis</Link>
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
