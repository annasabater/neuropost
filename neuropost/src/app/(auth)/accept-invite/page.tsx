'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function AcceptInvitePage() {
  const t = useTranslations('auth.acceptInvite');
  const searchParams = useSearchParams();
  const router       = useRouter();
  const token        = searchParams.get('token') ?? '';

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'idle'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage(t('invalidLink'));
      return;
    }
    acceptInvite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function acceptInvite() {
    setStatus('loading');
    try {
      const res  = await fetch('/api/team/accept-invite', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token }),
      });
      const json = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          // Not logged in — redirect to login then back
          router.push(`/login?next=/accept-invite?token=${token}`);
          return;
        }
        throw new Error(json.error ?? t('error'));
      }

      setStatus('success');
      setMessage(t('accepted'));
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : t('error'));
    }
  }

  return (
    <div style={{
      minHeight:      '100vh',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      background:     'var(--bg, #fdf8f3)',
      padding:        '24px',
    }}>
      <div style={{
        maxWidth:     420,
        width:        '100%',
        background:   'var(--surface, #fff)',
        borderRadius: 16,
        padding:      '40px 32px',
        boxShadow:    '0 4px 24px rgba(0,0,0,0.08)',
        textAlign:    'center',
      }}>
        <p style={{ fontSize: 32, marginBottom: 16 }}>
          {status === 'loading' ? '⏳' : status === 'success' ? '✅' : status === 'error' ? '❌' : '✉️'}
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
          {t(status as 'loading' | 'success' | 'error' | 'idle')}
        </h1>
        <p style={{ color: 'var(--muted, #888)', fontSize: 15, lineHeight: 1.5 }}>
          {message || t('checking')}
        </p>
        {status === 'success' && (
          <p style={{ color: 'var(--muted, #888)', fontSize: 13, marginTop: 8 }}>
            {t('redirecting')}
          </p>
        )}
        {status === 'error' && (
          <Link href="/login" style={{
            display:      'inline-block',
            marginTop:    20,
            padding:      '12px 24px',
            background:   '#ff6b35',
            color:        '#fff',
            borderRadius: 10,
            fontWeight:   700,
            textDecoration: 'none',
          }}>
            {t('goToLogin')}
          </Link>
        )}
      </div>
    </div>
  );
}
