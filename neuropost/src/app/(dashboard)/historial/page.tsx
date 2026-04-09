'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

type Post = {
  id: string; image_url: string | null; edited_image_url: string | null;
  caption: string | null; status: string; platform: string[];
  published_at: string | null; ig_post_id: string | null;
};

export default function HistorialPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/historial?status=published&range=all')
      .then((r) => r.json())
      .then((d) => { setPosts(d.posts ?? []); setLoading(false); });
  }, []);

  async function exportCSV() {
    const res = await fetch('/api/historial/export');
    if (!res.ok) { toast.error('Error al exportar'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'historial.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page-content" style={{ maxWidth: 1000 }}>
      {/* Header */}
      <div style={{ padding: '48px 0 28px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: 'var(--text-primary)', lineHeight: 0.95, marginBottom: 8 }}>
            Historial
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, fontFamily: f }}>
            {posts.length > 0 ? `${posts.length} publicaciones realizadas` : 'Tus publicaciones aparecerán aquí'}
          </p>
        </div>
        {posts.length > 0 && (
          <button onClick={exportCSV} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px',
            border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer',
            fontFamily: f, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0,
          }}>
            <Download size={14} /> Exportar CSV
          </button>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ background: 'var(--bg)' }}>
              <div style={{ aspectRatio: '1', background: 'var(--bg-1)' }} />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', border: '1px solid var(--border)', background: 'var(--bg)' }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>📭</div>
          <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 22, textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 8 }}>
            Tu historial está vacío
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-tertiary)', fontFamily: f, maxWidth: 400, margin: '0 auto 28px', lineHeight: 1.6 }}>
            Aquí aparecerán todas las publicaciones que hagas. Crea tu primer post y publícalo para empezar.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/posts/new" style={{
              background: '#111827', color: '#fff', padding: '11px 26px', textDecoration: 'none',
              fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              + Crear primer post
            </Link>
            <Link href="/posts" style={{
              background: 'var(--bg)', color: 'var(--text-primary)', padding: '11px 26px', textDecoration: 'none',
              fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
              display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)',
            }}>
              Ver posts pendientes
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)' }}>
          {posts.map((post) => {
            const img = post.edited_image_url ?? post.image_url;
            return (
              <Link key={post.id} href={`/posts/${post.id}`} className="post-card-hover" style={{
                background: 'var(--bg)', textDecoration: 'none', color: 'inherit',
                display: 'block', position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ aspectRatio: '1', background: '#111', overflow: 'hidden', position: 'relative' }}>
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.3s' }} />
                  ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: 'var(--text-tertiary)', background: 'var(--bg-1)' }}>
                      +
                    </div>
                  )}
                  {/* Bottom gradient */}
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%',
                    background: 'linear-gradient(transparent, rgba(0,0,0,0.5))',
                    pointerEvents: 'none',
                  }} />
                  {/* Date + IG link */}
                  <div style={{ position: 'absolute', bottom: 8, left: 10, right: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: f, fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
                      {post.published_at
                        ? new Date(post.published_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
                        : ''}
                    </span>
                    {post.ig_post_id && (
                      <span style={{ fontFamily: f, fontSize: 10, color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <ExternalLink size={10} /> IG
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
