'use client';

// ─────────────────────────────────────────────────────────────────────────────
//  /feed — client-facing multi-platform feed
//
//  Three tabs (Instagram / Facebook / TikTok), lazy-loaded. Each tab shows:
//    - Connection status + CTA to connect when offline
//    - "Programadas" section — post_publications with status scheduled /
//      pending / publishing / failed (fan-out scheduling)
//    - "Publicadas" grid — last 18 posts fetched through the platform's
//      provider (IG + FB works today, TikTok returns empty until the
//      research API scope lands; UI falls back to "no está disponible aún"
//      in that case).
//
//  Replaces the old single-platform /instagram page. /instagram now
//  redirects here for backward compatibility.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Camera, ExternalLink, RefreshCw, Facebook, Music2 } from 'lucide-react';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

type Platform = 'instagram' | 'facebook' | 'tiktok';

interface Published {
  id:        string;
  imageUrl:  string | null;
  caption:   string | null;
  permalink: string | null;
  timestamp: string | null;
  type?:     string;
}

interface Queued {
  id:          string;
  postId:      string;
  imageUrl:    string | null;
  caption:     string | null;
  status:      string;
  scheduledAt: string | null;
}

interface FeedData {
  platform:  Platform;
  connected: boolean;
  username:  string | null;
  published: Published[];
  queued:    Queued[];
}

const PLATFORMS: Record<Platform, {
  label:        string;
  emoji:        string;
  connectHref:  string;
  IconNode:     React.ReactNode;
}> = {
  instagram: { label: 'Instagram', emoji: '📷', connectHref: '/settings#redes', IconNode: <Camera size={14} /> },
  facebook:  { label: 'Facebook',  emoji: '📘', connectHref: '/settings#redes', IconNode: <Facebook size={14} /> },
  tiktok:    { label: 'TikTok',    emoji: '🎵', connectHref: '/settings#redes', IconNode: <Music2 size={14} /> },
};

const STATUS_COLOR: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: 'Pendiente',   color: '#78350f', bg: '#fef3c7' },
  scheduled:  { label: 'Programado',  color: '#1e40af', bg: '#dbeafe' },
  publishing: { label: 'Publicando',  color: '#5b21b6', bg: '#ede9fe' },
  failed:     { label: 'Fallido',     color: '#991b1b', bg: '#fee2e2' },
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const searchParams = useSearchParams();
  const initialTab   = (searchParams.get('platform') as Platform | null) ?? 'instagram';
  const [tab, setTab] = useState<Platform>(
    ['instagram', 'facebook', 'tiktok'].includes(initialTab) ? initialTab : 'instagram',
  );

  // Cache per platform so switching tabs doesn't re-fetch needlessly.
  const [cache, setCache]     = useState<Partial<Record<Platform, FeedData>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function loadTab(p: Platform, force = false) {
    if (!force && cache[p]) return;
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/feed/${p}`);
      const json = await res.json() as FeedData & { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Error cargando feed');
      setCache(prev => ({ ...prev, [p]: json }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTab(tab); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = cache[tab];

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Feed</h1>
          <p className="page-sub">Tu contenido en tiempo real · Instagram · Facebook · TikTok</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => loadTab(tab, true)}
            disabled={loading}
            style={{
              padding: '7px 12px', background: 'var(--bg)', border: '1px solid var(--border)',
              fontFamily: f, fontSize: 12, fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)',
            }}
          >
            <RefreshCw size={12} /> Actualizar
          </button>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {(['instagram', 'facebook', 'tiktok'] as const).map(p => {
          const meta   = PLATFORMS[p];
          const pData  = cache[p];
          const status = pData?.connected ? 'ok' : pData ? 'off' : null;
          return (
            <button
              key={p}
              onClick={() => setTab(p)}
              style={{
                padding: '12px 20px', background: 'transparent', border: 'none',
                borderBottom: `2px solid ${tab === p ? 'var(--accent)' : 'transparent'}`,
                fontFamily: fc, fontSize: 13, fontWeight: tab === p ? 800 : 600,
                color: tab === p ? 'var(--accent)' : 'var(--text-secondary)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <span>{meta.emoji}</span>
              <span>{meta.label}</span>
              {status && (
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: status === 'ok' ? '#0D9488' : '#9ca3af',
                }} />
              )}
            </button>
          );
        })}
      </div>

      {loading && !data && <p style={{ fontFamily: f, color: 'var(--muted)' }}>Cargando feed…</p>}

      {error && (
        <div style={{
          padding: 16, border: '1px solid #fca5a5', background: '#fef2f2',
          fontFamily: f, fontSize: 13, color: '#991b1b', marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {data && <PlatformPanel data={data} />}
    </div>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────────

function PlatformPanel({ data }: { data: FeedData }) {
  const meta = PLATFORMS[data.platform];

  if (!data.connected) {
    return (
      <div>
        {/* Not connected CTA */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '60px 24px', textAlign: 'center',
          border: '1px solid var(--border)', marginBottom: 32,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{meta.emoji}</div>
          <h2 style={{
            fontFamily: fc, fontWeight: 900, fontSize: '1.6rem', textTransform: 'uppercase',
            color: 'var(--ink)', marginBottom: 10,
          }}>
            {meta.label} no conectado
          </h2>
          <p style={{
            fontFamily: f, fontSize: 14, color: 'var(--muted)', maxWidth: 420,
            lineHeight: 1.7, marginBottom: 24,
          }}>
            Conecta tu cuenta para ver tu feed real de {meta.label}. Mientras tanto, las publicaciones
            que hayas programado desde NeuroPost seguirán visibles abajo.
          </p>
          <Link
            href={meta.connectHref}
            style={{
              padding: '10px 22px', background: '#0F766E', color: '#fff',
              textDecoration: 'none', fontFamily: fc, fontSize: 12, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            {meta.IconNode} Conectar {meta.label}
          </Link>
        </div>

        {/* Queued still visible even when not connected */}
        {data.queued.length > 0 && <QueuedSection platform={data.platform} queued={data.queued} />}
      </div>
    );
  }

  return (
    <div>
      {/* Connection bar */}
      <div style={{
        padding: '12px 16px', border: '1px solid var(--border)', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: '#0D9488',
        }} />
        <span style={{ fontFamily: f, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          {data.username ? `@${data.username}` : meta.label}
        </span>
        <span style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
          {data.published.length > 0 ? `${data.published.length} publicados` : 'Sin publicaciones en el feed'}
        </span>
      </div>

      {/* Queued */}
      {data.queued.length > 0 && <QueuedSection platform={data.platform} queued={data.queued} />}

      {/* Published grid */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{
          fontFamily: fc, fontSize: 13, fontWeight: 800, textTransform: 'uppercase',
          letterSpacing: '0.06em', color: 'var(--text-primary)', marginBottom: 12,
        }}>
          Publicados en {meta.label}
        </h2>

        {data.published.length === 0 ? (
          <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-tertiary)' }}>
            {data.platform === 'tiktok'
              ? 'El feed público de TikTok aún no está disponible vía API. Se conectará cuando aprueben el scope research.'
              : `No encontramos publicaciones en ${meta.label} todavía.`}
          </p>
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8,
          }}>
            {data.published.map(p => (
              <a
                key={p.id}
                href={p.permalink ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  position: 'relative', display: 'block', aspectRatio: '1',
                  border: '1px solid var(--border)', overflow: 'hidden',
                  background: '#000', textDecoration: 'none',
                }}
              >
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" style={{
                    width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                  }} />
                ) : (
                  <div style={{
                    width: '100%', height: '100%', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', background: 'var(--bg-1)',
                    fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)',
                  }}>Sin imagen</div>
                )}
                {p.permalink && (
                  <span style={{
                    position: 'absolute', top: 4, right: 4,
                    background: 'rgba(0,0,0,0.6)', padding: 3, color: '#fff',
                    display: 'inline-flex',
                  }}>
                    <ExternalLink size={10} />
                  </span>
                )}
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function QueuedSection({ platform, queued }: { platform: Platform; queued: Queued[] }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{
        fontFamily: fc, fontSize: 13, fontWeight: 800, textTransform: 'uppercase',
        letterSpacing: '0.06em', color: 'var(--text-primary)', marginBottom: 12,
      }}>
        En cola · {queued.length}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {queued.map(q => (
          <Link
            key={q.id}
            href={`/posts/${q.postId}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              border: '1px solid var(--border)', background: 'var(--bg)',
              textDecoration: 'none', color: 'inherit',
            }}
          >
            {q.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={q.imageUrl} alt="" style={{
                width: 36, height: 36, objectFit: 'cover', flexShrink: 0,
              }} />
            ) : (
              <div style={{
                width: 36, height: 36, background: 'var(--bg-1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Camera size={14} style={{ color: 'var(--text-tertiary)' }} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontFamily: f, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {q.caption?.slice(0, 80) ?? '(sin caption)'}
              </p>
              <p style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)' }}>
                {platform} ·{' '}
                {q.scheduledAt
                  ? new Date(q.scheduledAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
                  : 'sin fecha'}
              </p>
            </div>
            <StatusPill status={q.status} />
          </Link>
        ))}
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const s = STATUS_COLOR[status] ?? { label: status, color: '#4b5563', bg: '#f3f4f6' };
  return (
    <span style={{
      padding: '2px 8px', background: s.bg, color: s.color, fontFamily: f,
      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
    }}>
      {s.label}
    </span>
  );
}
