'use client';

import Link from 'next/link';

const SUGGESTED = [
  { label: 'Funciones', href: '/#funciones', desc: 'Todo lo que NeuroPost puede hacer por tu negocio.' },
  { label: 'Precios',   href: '/pricing',   desc: 'Planes claros sin letra pequeña.' },
  { label: 'Nosotros',  href: '/about',      desc: 'Quiénes somos y por qué construimos NeuroPost.' },
];

export default function NotFound() {
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
        paddingTop: '120px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '120px 28px 80px',
      }}>
        <div style={{
          fontFamily: "'Cabinet Grotesk', sans-serif",
          fontWeight: 900,
          fontSize: 'clamp(6rem, 15vw, 9rem)',
          color: 'var(--orange)',
          lineHeight: 1,
          letterSpacing: '-0.04em',
        }}>
          404
        </div>

        <h2 style={{ marginTop: '24px', marginBottom: '12px' }}>
          Esta página no existe
        </h2>

        <p style={{
          color: 'var(--muted)',
          fontSize: '1.1rem',
          marginBottom: '40px',
          fontFamily: "'Cabinet Grotesk', sans-serif",
        }}>
          O se fue de vacaciones sin avisar.
        </p>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '64px' }}>
          <Link
            href="/"
            className="btn-primary"
            style={{
              background: 'var(--ink)',
              color: 'var(--cream)',
              padding: '14px 28px',
              borderRadius: '8px',
              fontFamily: "'Cabinet Grotesk', sans-serif",
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            ← Volver al inicio
          </Link>
          <Link
            href="/dashboard"
            className="btn-primary"
            style={{
              padding: '14px 28px',
              borderRadius: '8px',
              fontFamily: "'Cabinet Grotesk', sans-serif",
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Ir al dashboard →
          </Link>
        </div>

        {/* Suggested pages */}
        <div style={{ width: '100%', maxWidth: '700px' }}>
          <p style={{
            color: 'var(--muted)',
            fontSize: '0.85rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontFamily: "'Cabinet Grotesk', sans-serif",
            fontWeight: 700,
            marginBottom: '20px',
          }}>
            Quizás buscabas
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px',
          }}>
            {SUGGESTED.map(({ label, href, desc }) => (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'block',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '20px',
                  textDecoration: 'none',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  textAlign: 'left',
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-3px)';
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  (e.currentTarget as HTMLAnchorElement).style.transform = '';
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = '';
                }}
              >
                <div style={{
                  fontFamily: "'Cabinet Grotesk', sans-serif",
                  fontWeight: 800,
                  fontSize: '1rem',
                  color: 'var(--ink)',
                  marginBottom: '6px',
                }}>
                  {label}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                  {desc}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
