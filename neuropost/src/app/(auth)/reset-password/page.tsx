'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { createBrowserClient } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const t = useTranslations('auth.resetPassword');
  const passwordRef        = useRef<HTMLInputElement>(null);
  const confirmRef         = useRef<HTMLInputElement>(null);
  const [loading, setLoading]   = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const router                  = useRouter();

  const meetsLength = password.length >= 8;
  const matches     = password.length > 0 && confirm.length > 0 && password === confirm;
  const mismatch    = confirm.length > 0 && password !== confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!matches) { toast.error(t('noMatch')); return; }
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success(t('updated'));
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
        <h1 className="auth-title">{t('title')}</h1>
        <p className="auth-sub">{t('subtitle')}</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="password">{t('newPassword')}</label>
            <input
              ref={passwordRef}
              id="password"
              type="password"
              placeholder="Mín. 8 caracteres"
              minLength={8}
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p style={{
              fontFamily: "var(--font-barlow), sans-serif",
              fontSize: 11, marginTop: 5,
              color: meetsLength ? '#16a34a' : (password.length > 0 ? '#dc2626' : 'var(--text-tertiary)'),
            }}>
              {meetsLength ? '✓ Mínimo 8 caracteres' : 'Mínimo 8 caracteres'}
            </p>
          </div>
          <div className="form-group">
            <label htmlFor="confirm">{t('confirm')}</label>
            <input
              ref={confirmRef}
              id="confirm"
              type="password"
              placeholder="Repite la contraseña"
              minLength={8}
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={{ borderColor: mismatch ? '#dc2626' : matches ? '#16a34a' : undefined }}
            />
            {matches  && <p style={{ fontFamily: "var(--font-barlow), sans-serif", fontSize: 11, marginTop: 5, color: '#16a34a' }}>✓ Las contraseñas coinciden</p>}
            {mismatch && <p style={{ fontFamily: "var(--font-barlow), sans-serif", fontSize: 11, marginTop: 5, color: '#dc2626' }}>Las contraseñas no coinciden</p>}
          </div>
          <button type="submit" className="btn-primary btn-full" disabled={loading || !matches} style={{ marginTop: 4 }}>
            {loading ? <><span className="loading-spinner" />{t('saving')}</> : t('submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
