'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BLOG_POSTS } from '@/lib/blog-posts';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function BlogPage() {
  const [navShadow, setNavShadow] = useState(false);

  useEffect(() => {
    const onScroll = () => setNavShadow(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      {/* ─── NAV ─── */}
      <nav style={{ boxShadow: navShadow ? '0 4px 20px rgba(0,0,0,0.06)' : 'none' }}>
        <Link href="/" className="nav-logo">
          <span className="logo-dot" />
          NeuroPost
        </Link>
        <ul className="nav-links">
          <li><Link href="/#funciones">Funciones</Link></li>
          <li><Link href="/#precios">Precios</Link></li>
          <li><Link href="/about">Nosotros</Link></li>
          <li><Link href="/login" className="nav-login">Iniciar sesión</Link></li>
          <li><Link href="/register" className="nav-cta">Empezar gratis</Link></li>
        </ul>
      </nav>

      {/* ─── HERO ─── */}
      <section style={{
        paddingTop: '120px',
        paddingBottom: '64px',
        background: 'var(--warm)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <div style={{
            display: 'inline-block',
            background: 'var(--orange-light)',
            color: 'var(--orange)',
            fontFamily: "'Cabinet Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: '0.8rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            padding: '6px 16px',
            borderRadius: '20px',
            marginBottom: '20px',
          }}>
            Blog
          </div>
          <h1 style={{ marginBottom: '16px', fontSize: 'clamp(2rem, 5vw, 3rem)' }}>
            Recursos para negocios locales
          </h1>
          <p style={{
            color: 'var(--muted)',
            fontSize: '1.1rem',
            maxWidth: '520px',
            margin: '0 auto',
            fontFamily: "'Cabinet Grotesk', sans-serif",
          }}>
            Guías, estrategias y tendencias para crecer en Instagram y Facebook sin complicaciones.
          </p>
        </div>
      </section>

      {/* ─── ARTICLES ─── */}
      <section style={{ padding: '64px 0 80px' }}>
        <div className="container">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '28px',
          }}>
            {BLOG_POSTS.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                style={{ textDecoration: 'none' }}
              >
                <article style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '16px',
                  padding: '28px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 32px rgba(0,0,0,0.09)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = '';
                  (e.currentTarget as HTMLElement).style.boxShadow = '';
                }}
                >
                  {/* Read time tag */}
                  <span style={{
                    display: 'inline-block',
                    background: 'var(--orange-light)',
                    color: 'var(--orange)',
                    fontFamily: "'Cabinet Grotesk', sans-serif",
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    alignSelf: 'flex-start',
                  }}>
                    {post.readTime} min
                  </span>

                  <h2 style={{
                    fontFamily: "'Cabinet Grotesk', sans-serif",
                    fontSize: '1.15rem',
                    fontWeight: 800,
                    color: 'var(--ink)',
                    lineHeight: 1.3,
                    margin: 0,
                  }}>
                    {post.title}
                  </h2>

                  <p style={{
                    color: 'var(--muted)',
                    fontSize: '0.92rem',
                    lineHeight: 1.6,
                    flexGrow: 1,
                    margin: 0,
                    fontFamily: "'Cabinet Grotesk', sans-serif",
                  }}>
                    {post.excerpt}
                  </p>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border)',
                    fontSize: '0.82rem',
                    color: 'var(--muted)',
                    fontFamily: "'Cabinet Grotesk', sans-serif",
                  }}>
                    <span>{formatDate(post.date)}</span>
                    <span>·</span>
                    <span>{post.readTime} min de lectura</span>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section style={{
        background: 'var(--ink)',
        color: 'var(--cream)',
        padding: '80px 0',
        textAlign: 'center',
      }}>
        <div className="container">
          <h2 style={{ color: 'var(--cream)', marginBottom: '16px' }}>
            ¿Quieres que llevemos tu Instagram?
          </h2>
          <p style={{
            color: 'rgba(250,248,243,0.65)',
            fontFamily: "'Cabinet Grotesk', sans-serif",
            fontSize: '1.05rem',
            marginBottom: '32px',
          }}>
            Automatiza tus redes con IA. 14 días gratis, sin tarjeta de crédito.
          </p>
          <Link
            href="/register"
            className="btn-primary"
            style={{
              display: 'inline-block',
              padding: '16px 36px',
              borderRadius: '8px',
              fontFamily: "'Cabinet Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: '1rem',
              textDecoration: 'none',
            }}
          >
            Empezar gratis →
          </Link>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer style={{
        background: 'var(--ink)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '40px 0',
      }}>
        <div className="container" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}>
          <Link href="/" className="nav-logo" style={{ color: 'var(--cream)' }}>
            <span className="logo-dot" />
            NeuroPost
          </Link>
          <span style={{
            color: 'rgba(250,248,243,0.4)',
            fontFamily: "'Cabinet Grotesk', sans-serif",
            fontSize: '0.85rem',
          }}>
            © 2025 NeuroPost · Todos los derechos reservados
          </span>
        </div>
      </footer>
    </>
  );
}
