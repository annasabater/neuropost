'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { createBrowserClient } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const passwordRef        = useRef<HTMLInputElement>(null);
  const confirmRef         = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const router                = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const password = passwordRef.current!.value;
    const confirm  = confirmRef.current!.value;

    if (password !== confirm) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success('Contraseña actualizada correctamente');
      router.push('/login');
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
        <h1 className="auth-title">Nueva contraseña</h1>
        <p className="auth-sub">Escribe tu nueva contraseña. Mínimo 8 caracteres.</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="password">Nueva contraseña</label>
            <input ref={passwordRef} id="password" type="password" placeholder="Mín. 8 caracteres" minLength={8} required autoComplete="new-password" />
          </div>
          <div className="form-group">
            <label htmlFor="confirm">Confirmar contraseña</label>
            <input ref={confirmRef} id="confirm" type="password" placeholder="Repite la contraseña" minLength={8} required autoComplete="new-password" />
          </div>
          <button type="submit" className="btn-primary btn-full" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? <><span className="loading-spinner" />Guardando...</> : 'Guardar contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
}
