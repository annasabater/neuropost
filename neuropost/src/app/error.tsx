'use client';

import { useEffect } from 'react';
import Link from 'next/link';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Sentry hook placeholder
    console.error('[Sentry]', error);
  }, [error]);

  return (
    <>
      {/* ─── NAV ─── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(250,248,243,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 28px',
        height: '64px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" className="nav-logo">
          <span className="logo-dot" />
          NeuroPost
        </Link>
      </nav>

      {/* ─── CONTENT ─── */}
      <main style={{
        minHeight: '100vh',
        background: 'var(--cream)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '120px 28px 80px',
      }}>
        <div style={{ fontSize: '5rem', lineHeight: 1, marginBottom: '24px' }}>⚠️</div>

        <h2 style={{ marginBottom: '12px' }}>Algo ha fallado</h2>

        <p style={{
          color: 'var(--muted)',
          fontSize: '1.05rem',
          marginBottom: '40px',
          maxWidth: '400px',
          fontFamily: "'Cabinet Grotesk', sans-serif",
          lineHeight: 1.6,
        }}>
          Ha ocurrido un error inesperado. Ya estamos al tanto.
        </p>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={reset}
            className="btn-primary"
            style={{
              padding: '14px 28px',
              borderRadius: '8px',
              fontFamily: "'Cabinet Grotesk', sans-serif",
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
          <Link
            href="/"
            style={{
              display: 'inline-block',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--ink)',
              padding: '14px 28px',
              borderRadius: '8px',
              fontFamily: "'Cabinet Grotesk', sans-serif",
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Ir al inicio
          </Link>
        </div>
      </main>
    </>
  );
}
