'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const token        = searchParams.get('token') ?? '';

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'idle'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Enlace de invitación no válido.');
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
        throw new Error(json.error ?? 'Error al aceptar la invitación');
      }

      setStatus('success');
      setMessage('¡Invitación aceptada! Ahora tienes acceso al equipo.');
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Error inesperado');
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
          {status === 'loading' ? 'Procesando invitación…'
           : status === 'success' ? '¡Bienvenido al equipo!'
           : status === 'error' ? 'Invitación no válida'
           : 'Invitación de equipo'}
        </h1>
        <p style={{ color: 'var(--muted, #888)', fontSize: 15, lineHeight: 1.5 }}>
          {message || 'Comprobando tu invitación…'}
        </p>
        {status === 'success' && (
          <p style={{ color: 'var(--muted, #888)', fontSize: 13, marginTop: 8 }}>
            Redirigiendo al panel…
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
            Ir al inicio de sesión
          </Link>
        )}
      </div>
    </div>
  );
}
