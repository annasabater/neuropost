import type { Metadata } from 'next';
import Link from 'next/link';
import { BLOG_POSTS } from '@/lib/blog-posts';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

function extractHeadings(html: string): string[] {
  const matches = html.match(/<h2>([^<]+)<\/h2>/g) ?? [];
  return matches.map((m) => m.replace(/<\/?h2>/g, ''));
}

export async function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  if (!post) return { title: 'Artículo no encontrado — NeuroPost Blog' };
  return {
    title: `${post.title} — NeuroPost Blog`,
    description: post.excerpt,
    openGraph: { title: post.title, description: post.excerpt, type: 'article' },
    alternates: { canonical: `https://neuropost.es/blog/${slug}` },
  };
}

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);

  if (!post) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', paddingTop: 64 }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontFamily: "'Cabinet Grotesk',sans-serif", color: 'var(--orange)', marginBottom: 16 }}>Artículo no encontrado</h1>
          <Link href="/blog" style={{ color: 'var(--orange)', fontFamily: "'Cabinet Grotesk',sans-serif" }}>← Volver al blog</Link>
        </div>
      </div>
    );
  }

  const headings = extractHeadings(post.content);

  return (
    <>
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(250,248,243,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', padding: '0 28px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" className="nav-logo"><span className="logo-dot" />NeuroPost</Link>
        <ul className="nav-links">
          <li><Link href="/blog" style={{ color: 'var(--muted)', fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 500, textDecoration: 'none' }}>Blog</Link></li>
          <li><Link href="/login" className="nav-login">Iniciar sesión</Link></li>
          <li><Link href="/register" className="nav-cta">Empezar gratis</Link></li>
        </ul>
      </nav>

      <div style={{ paddingTop: 96, background: 'var(--cream)', minHeight: '100vh' }}>
        <div className="container" style={{ maxWidth: 1100 }}>
          <div style={{ paddingTop: 32, marginBottom: 32 }}>
            <Link href="/blog" style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.85rem', color: 'var(--muted)', textDecoration: 'none' }}>← Blog</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 60, alignItems: 'start' }}>
            <article>
              <div style={{ marginBottom: 40 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <span style={{ background: 'var(--orange-light)', color: 'var(--orange)', fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 700, fontSize: '0.75rem', padding: '4px 12px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{post.readTime} min</span>
                  <span style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.82rem', color: 'var(--muted)' }}>{post.readTime} min de lectura · {formatDate(post.date)}</span>
                </div>
                <h1 style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 900, fontSize: 'clamp(1.8rem,3.5vw,2.8rem)', letterSpacing: '-0.03em', color: 'var(--ink)', lineHeight: 1.1, marginBottom: 20 }}>{post.title}</h1>
                <p style={{ fontSize: '1.1rem', color: 'var(--muted)', lineHeight: 1.7 }}>{post.excerpt}</p>
                <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 800, fontSize: '0.85rem', color: 'white' }}>P</div>
                  <div>
                    <div style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 700, fontSize: '0.9rem', color: 'var(--ink)' }}>Equipo NeuroPost</div>
                    <div style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.78rem', color: 'var(--muted)' }}>Expertos en redes para negocios locales</div>
                  </div>
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 40 }}>
                <div style={{ lineHeight: 1.8, color: 'var(--ink)', fontSize: '1rem' }}
                  dangerouslySetInnerHTML={{ __html: post.content
                    .replace(/<h2>/g, `<h2 style="font-family:'Cabinet Grotesk',sans-serif;font-weight:800;font-size:1.4rem;color:var(--ink);margin:40px 0 16px;letter-spacing:-0.02em">`)
                    .replace(/<p>/g, `<p style="margin-bottom:16px;color:var(--muted);line-height:1.8">`)
                  }}
                />
              </div>
              <div style={{ marginTop: 64, background: 'var(--ink)', borderRadius: 20, padding: '40px 36px', textAlign: 'center' }}>
                <h3 style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 900, fontSize: '1.4rem', color: 'white', marginBottom: 12, letterSpacing: '-0.03em' }}>¿Quieres que llevemos las redes de tu negocio?</h3>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem', marginBottom: 24 }}>14 días gratis. Sin tarjeta de crédito.</p>
                <Link href="/register" style={{ display: 'inline-block', background: 'var(--orange)', color: 'white', fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 700, padding: '14px 32px', borderRadius: 40, textDecoration: 'none', fontSize: '0.95rem' }}>Empezar gratis →</Link>
              </div>
            </article>
            <aside style={{ position: 'sticky', top: 96 }}>
              {headings.length > 0 && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', marginBottom: 20 }}>
                  <div style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 700, fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>En este artículo</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {headings.map((h, i) => (
                      <span key={i} style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.85rem', color: 'var(--ink)', lineHeight: 1.4 }}>{h}</span>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ background: 'var(--orange-light)', border: '1px solid rgba(255,92,26,0.2)', borderRadius: 14, padding: '20px 24px' }}>
                <div style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 800, fontSize: '0.95rem', color: 'var(--ink)', marginBottom: 8 }}>Automatiza tu Instagram</div>
                <p style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.5, marginBottom: 14 }}>14 días gratis para ver los resultados.</p>
                <Link href="/register" style={{ display: 'block', textAlign: 'center', background: 'var(--orange)', color: 'white', fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 700, padding: '10px 16px', borderRadius: 40, textDecoration: 'none', fontSize: '0.85rem' }}>Probar gratis →</Link>
              </div>
            </aside>
          </div>
        </div>
      </div>
      <footer>
        <div className="container">
          <div className="footer-bottom">
            <span>© 2025 NeuroPost · Todos los derechos reservados</span>
            <Link href="/blog" style={{ color: 'rgba(250,248,243,0.5)', textDecoration: 'none', fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.85rem' }}>← Volver al blog</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
