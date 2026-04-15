'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, RefreshCw, Camera } from 'lucide-react';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PublishedPost {
  id:        string;
  imageUrl:  string | null;
  caption:   string | null;
  permalink: string | null;
  timestamp: string | null;
}

interface QueuedPost {
  id:          string;
  postId:      string;
  imageUrl:    string | null;
  caption:     string | null;
  status:      string;
  scheduledAt: string | null;
  position:    number;
}

interface FeedData {
  connected: boolean;
  username:  string | null;
  published: PublishedPost[];
  queued:    QueuedPost[];
}

// ─── Status label ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  draft:     'Borrador',
  generated: 'Generado',
  pending:   'Pendiente',
  approved:  'Aprobado',
  scheduled: 'Programado',
  published: 'Publicado',
};

const STATUS_COLOR: Record<string, string> = {
  draft:     '#9ca3af',
  generated: '#6366f1',
  pending:   '#f59e0b',
  approved:  '#0F766E',
  scheduled: '#3b82f6',
  published: '#10b981',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InstagramFeedPage() {
  const [data,    setData]    = useState<FeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch('/api/meta/feed-preview');
      const json = await res.json() as FeedData & { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar el feed');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // ─── Not connected ──────────────────────────────────────────────────────────

  if (!loading && data && !data.connected) {
    return (
      <div className="page-content">
        <div className="page-header">
          <div className="page-header-text">
            <h1 className="page-title">Feed de Instagram</h1>
            <p className="page-sub">Conecta tu cuenta para ver y gestionar tu contenido</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>📷</div>
          <h2 style={{ fontFamily: fc, fontWeight: 900, fontSize: '1.8rem', textTransform: 'uppercase', color: 'var(--ink)', marginBottom: 12 }}>
            Instagram no conectado
          </h2>
          <p style={{ fontFamily: f, fontSize: 15, color: 'var(--muted)', maxWidth: 440, lineHeight: 1.7, marginBottom: 32 }}>
            Conecta tu cuenta de Instagram para ver tu feed real, gestionar lo que está pendiente de publicar y controlar toda tu presencia.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link href="/settings/connections" className="btn-primary" style={{ textDecoration: 'none' }}>
              <Camera size={15} /> Conectar Instagram
            </Link>
            <Link href="/settings/connections" className="btn-outline" style={{ textDecoration: 'none' }}>
              Cómo configurarlo →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Loading / error ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page-content">
        <div className="page-header">
          <div className="page-header-text">
            <h1 className="page-title">Feed de Instagram</h1>
            <p className="page-sub">Cargando tu contenido...</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} style={{ width: 180, height: 180, background: 'var(--bg-1)', animation: 'pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.08}s` }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-content">
        <div className="page-header">
          <div className="page-header-text">
            <h1 className="page-title">Feed de Instagram</h1>
          </div>
        </div>
        <div style={{ background: '#fff7f7', border: '1px solid #fca5a5', padding: '16px 20px' }}>
          <p style={{ fontFamily: f, fontSize: 14, color: '#991b1b', margin: 0 }}>
            ⚠ {error}
          </p>
          <button onClick={load} className="btn-outline" style={{ marginTop: 12, fontSize: 13 }}>
            <RefreshCw size={13} /> Reintentar
          </button>
        </div>
      </div>
    );
  }

  // ─── Main feed ──────────────────────────────────────────────────────────────

  const published = data?.published ?? [];
  const queued    = data?.queued    ?? [];

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Feed de Instagram</h1>
          <p className="page-sub">
            {data?.username ? `@${data.username}` : 'Tu cuenta conectada'}
            {published.length > 0 && ` · ${published.length} publicaciones recientes`}
          </p>
        </div>
        <button onClick={load} className="btn-outline" style={{ fontSize: 13, alignSelf: 'flex-start' }}>
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>

      {/* ── Queued (to publish) ── */}
      {queued.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontFamily: fc, fontWeight: 800, fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink)', margin: 0 }}>
              Pendiente de publicar
              <span style={{ fontFamily: f, fontSize: 12, fontWeight: 400, color: 'var(--muted)', marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
                {queued.length} {queued.length === 1 ? 'post' : 'posts'}
              </span>
            </h2>
            <Link href="/posts" style={{ fontFamily: f, fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
              Ver todos →
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 2 }}>
            {queued.map((post) => (
              <Link
                key={post.id}
                href={`/posts/${post.postId}`}
                style={{ textDecoration: 'none', display: 'block', position: 'relative', aspectRatio: '1', overflow: 'hidden', background: 'var(--bg-1)', border: '1px solid var(--border)' }}
              >
                {post.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.imageUrl}
                    alt={post.caption ?? ''}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: f, fontSize: 11, color: 'var(--muted)' }}>Sin imagen</span>
                  </div>
                )}

                {/* Status badge */}
                <div style={{
                  position: 'absolute', top: 6, left: 6,
                  background: STATUS_COLOR[post.status] ?? '#9ca3af',
                  color: '#ffffff', fontFamily: f, fontSize: 10, fontWeight: 700,
                  padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {STATUS_LABEL[post.status] ?? post.status}
                </div>

                {/* Scheduled date */}
                {post.scheduledAt && (
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: 'rgba(0,0,0,0.75)', padding: '4px 8px',
                  }}>
                    <p style={{ fontFamily: f, fontSize: 10, color: '#ffffff', margin: 0 }}>
                      {new Date(post.scheduledAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                )}

                {/* Caption hover */}
                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)',
                  transition: 'background 0.2s', display: 'flex', alignItems: 'flex-end',
                  padding: '10px 8px',
                }}>
                  {post.caption && (
                    <p style={{ fontFamily: f, fontSize: 11, color: '#ffffff', margin: 0, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {post.caption}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Published (live on Instagram) ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontFamily: fc, fontWeight: 800, fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink)', margin: 0 }}>
            Publicado en Instagram
            {published.length > 0 && (
              <span style={{ fontFamily: f, fontSize: 12, fontWeight: 400, color: 'var(--muted)', marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
                Últimas {published.length} publicaciones
              </span>
            )}
          </h2>
          {data?.username && (
            <a
              href={`https://instagram.com/${data.username}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontFamily: f, fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              Ver perfil <ExternalLink size={12} />
            </a>
          )}
        </div>

        {published.length === 0 ? (
          <div style={{ border: '1px solid var(--border)', padding: '48px 24px', textAlign: 'center' }}>
            <p style={{ fontFamily: f, fontSize: 14, color: 'var(--muted)', margin: 0 }}>
              {data?.connected
                ? 'No se encontraron publicaciones en tu cuenta de Instagram.'
                : 'Conecta tu Instagram para ver tus publicaciones aquí.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
            {published.map((post) => (
              <a
                key={post.id}
                href={post.permalink ?? '#'}
                target={post.permalink ? '_blank' : undefined}
                rel="noopener noreferrer"
                style={{ textDecoration: 'none', display: 'block', position: 'relative', aspectRatio: '1', overflow: 'hidden', background: 'var(--bg-1)' }}
              >
                {post.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.imageUrl}
                    alt={post.caption ?? ''}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.2s' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: f, fontSize: 11, color: 'var(--muted)' }}>Sin imagen</span>
                  </div>
                )}

                {/* Hover overlay */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(0,0,0,0)',
                  transition: 'background 0.2s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: 12,
                }}>
                  {post.caption && (
                    <p style={{ fontFamily: f, fontSize: 12, color: '#ffffff', margin: 0, textAlign: 'center', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {post.caption}
                    </p>
                  )}
                  {post.timestamp && (
                    <p style={{ fontFamily: f, fontSize: 10, color: 'rgba(255,255,255,0.7)', margin: 0 }}>
                      {new Date(post.timestamp).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
