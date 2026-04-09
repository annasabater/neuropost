'use client';

import Link from 'next/link';
import { BLOG_POSTS } from '@/lib/blog-posts';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { LandingNav } from '@/components/layout/LandingNav';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function BlogPage() {
  return (
    <>
      <LandingNav />

      {/* ─── HERO ─── */}
      <section style={{
        paddingTop: '140px',
        paddingBottom: '60px',
        background: '#ffffff',
        borderBottom: '1px solid var(--border)',
      }}>
        <div className="container" style={{ maxWidth: 900, textAlign: 'center' }}>
          <div style={{
            fontFamily: f,
            fontWeight: 600,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            color: '#0F766E',
            marginBottom: 14,
          }}>
            Recursos
          </div>
          <h1 style={{
            marginBottom: 12,
            fontFamily: fc,
            fontWeight: 900,
            fontSize: 'clamp(2.4rem, 5vw, 4rem)',
            textTransform: 'uppercase',
            letterSpacing: '-0.01em',
            lineHeight: 0.95,
            color: '#111111',
          }}>
            Recursos para negocios locales
          </h1>
          <p style={{
            color: '#6b7280',
            fontSize: 16,
            lineHeight: 1.75,
            maxWidth: 700,
            margin: '0 auto',
            fontFamily: f,
          }}>
            Guías, estrategias y tendencias para crecer en Instagram y Facebook sin complicaciones.
          </p>
        </div>
      </section>

      {/* ─── ARTICLES ─── */}
      <section style={{ padding: '56px 0 80px' }}>
        <div className="container">
          <div className="blog-grid-squares" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 1,
            background: '#e5e7eb',
            border: '1px solid #e5e7eb',
          }}>
            {BLOG_POSTS.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                style={{ textDecoration: 'none' }}
              >
                <article style={{
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  padding: '24px 22px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  transition: 'background 0.2s ease',
                }}>
                  {/* Read time tag */}
                  <span style={{
                    display: 'inline-block',
                    background: '#f0fdfa',
                    color: '#0F766E',
                    fontFamily: f,
                    fontWeight: 700,
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    padding: '3px 10px',
                    alignSelf: 'flex-start',
                  }}>
                    {post.readTime} min
                  </span>

                  <h2 style={{
                    fontFamily: fc,
                    fontSize: 24,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    color: '#111111',
                    lineHeight: 1.05,
                    margin: 0,
                  }}>
                    {post.title}
                  </h2>

                  <p style={{
                    color: '#6b7280',
                    fontSize: 14,
                    lineHeight: 1.7,
                    flexGrow: 1,
                    margin: 0,
                    fontFamily: f,
                  }}>
                    {post.excerpt}
                  </p>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    paddingTop: '12px',
                    borderTop: '1px solid #e5e7eb',
                    fontSize: 12,
                    color: '#6b7280',
                    fontFamily: f,
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
        background: '#111111',
        color: '#f5f5f5',
        padding: '80px 0',
        textAlign: 'center',
      }}>
        <div className="container">
          <h2 style={{ color: '#f5f5f5', marginBottom: '12px', fontFamily: fc, fontWeight: 900, textTransform: 'uppercase', fontSize: 'clamp(2rem, 5vw, 3.2rem)', lineHeight: 0.95 }}>
            ¿Quieres que llevemos tu Instagram?
          </h2>
          <p style={{
            color: '#9ca3af',
            fontFamily: f,
            fontSize: 15,
            marginBottom: '32px',
          }}>
            Automatiza tus redes con IA. 14 días gratis, sin tarjeta de crédito.
          </p>
          <Link
            href="/register"
            style={{
              display: 'inline-block',
              padding: '14px 30px',
              background: '#ffffff',
              color: '#111111',
              fontFamily: fc,
              fontWeight: 700,
              fontSize: 13,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              textDecoration: 'none',
            }}
          >
            Empezar gratis →
          </Link>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
