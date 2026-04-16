'use client';

// ─────────────────────────────────────────────────────────────────────────────
//  /worker/clientes/[brandId]/plataformas
//
//  Per-brand multi-platform dashboard. Internal tabs:
//    Resumen (overview) — comparative CSS bars across IG / FB / TikTok
//    Instagram          — connection + feed + scheduled
//    Facebook           — connection + feed + scheduled
//    TikTok             — connection + feed + scheduled
//
//  One data fetch from GET /api/worker/brands/[brandId]/platforms delivers
//  everything the page needs. No per-tab refetch — tab switching is pure UI.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, CheckCircle2, AlertTriangle, XCircle,
  ExternalLink, RefreshCw, Clock, Image as ImageIcon, Video, Layers, Film,
} from 'lucide-react';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

type Platform = 'instagram' | 'facebook' | 'tiktok';

interface Connection {
  platform:                Platform;
  platform_user_id:        string;
  platform_username:       string | null;
  status:                  'active' | 'expired' | 'revoked' | 'error';
  expires_at:              string | null;
  last_token_refresh_at:   string | null;
  last_insights_synced_at: string | null;
  last_feed_synced_at:     string | null;
  metadata:                Record<string, unknown> | null;
}

interface Publication {
  id:                string;
  post_id:           string;
  platform:          Platform;
  status:            string;
  scheduled_at:      string | null;
  published_at:      string | null;
  platform_post_id:  string | null;
  platform_post_url: string | null;
  error_message:     string | null;
  created_at:        string;
  post: {
    id:               string;
    caption:          string | null;
    image_url:        string | null;
    edited_image_url: string | null;
    format:           string | null;
    status:           string;
  } | null;
}

interface PlatformStats {
  total_published:    number;
  published_last_30d: number;
  scheduled_pending:  number;
  failures_7d:        number;
}

interface Data {
  brandId:      string;
  connections:  Connection[];
  publications: Publication[];
  scheduled:    Publication[];
  stats:        Record<Platform, PlatformStats>;
  generatedAt:  string;
}

const PLATFORMS: { key: Platform; label: string; emoji: string; color: string }[] = [
  { key: 'instagram', label: 'Instagram', emoji: '📷', color: '#E1306C' },
  { key: 'facebook',  label: 'Facebook',  emoji: '📘', color: '#1877F2' },
  { key: 'tiktok',    label: 'TikTok',    emoji: '🎵', color: '#000000' },
];

type TabKey = 'overview' | Platform;

export default function PlatformsPage() {
  const { brandId } = useParams<{ brandId: string }>();
  const router      = useRouter();
  const [tab, setTab]     = useState<TabKey>('overview');
  const [data, setData]   = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/worker/brands/${brandId}/platforms`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Error cargando datos');
        if (!cancelled) setData(json as Data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [brandId]);

  if (loading) {
    return (
      <div className="page-content">
        <p style={{ fontFamily: f, color: 'var(--muted)' }}>Cargando…</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="page-content">
        <p style={{ fontFamily: f, color: 'var(--error)' }}>{error ?? 'Sin datos'}</p>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div style={{ padding: '20px 0 0' }}>
        <button
          onClick={() => router.back()}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', fontFamily: f, fontSize: 13,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}
        >
          <ArrowLeft size={14} /> Volver
        </button>
      </div>

      <div className="page-header" style={{ marginBottom: 12 }}>
        <div className="page-header-text">
          <h1 className="page-title">Plataformas</h1>
          <p className="page-sub">
            Visión por red social · última actualización{' '}
            {new Date(data.generatedAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
          </p>
        </div>
      </div>

      {/* ── Top-level tabs ────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: '1px solid var(--border)',
        marginBottom: 20, flexWrap: 'wrap',
      }}>
        <TabButton label="Resumen" active={tab === 'overview'} onClick={() => setTab('overview')} />
        {PLATFORMS.map(p => {
          const conn = data.connections.find(c => c.platform === p.key);
          return (
            <TabButton
              key={p.key}
              label={`${p.emoji} ${p.label}`}
              badge={conn?.status === 'active' ? 'ok' : conn ? 'warn' : 'off'}
              active={tab === p.key}
              onClick={() => setTab(p.key)}
            />
          );
        })}
      </div>

      {tab === 'overview' && <OverviewTab data={data} />}
      {tab !== 'overview' && (
        <PlatformTab
          platform={tab}
          data={data}
          onRefresh={() => {
            // Trigger a refetch by toggling loading
            setLoading(true);
            fetch(`/api/worker/brands/${brandId}/platforms`)
              .then(r => r.json())
              .then(j => setData(j as Data))
              .finally(() => setLoading(false));
          }}
        />
      )}
    </div>
  );
}

// ─── Tab button ─────────────────────────────────────────────────────────────

function TabButton({
  label, active, onClick, badge,
}: {
  label:    string;
  active:   boolean;
  onClick:  () => void;
  badge?:   'ok' | 'warn' | 'off';
}) {
  const badgeColor = badge === 'ok' ? '#0D9488' : badge === 'warn' ? '#b45309' : '#9ca3af';
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '10px 18px', background: 'transparent', border: 'none',
        borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
        fontFamily: fc, fontSize: 13, fontWeight: active ? 800 : 600,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
      }}
    >
      {label}
      {badge && (
        <span style={{
          width: 6, height: 6, background: badgeColor, display: 'inline-block',
          borderRadius: '50%',
        }} />
      )}
    </button>
  );
}

// ─── Overview tab ───────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: Data }) {
  const max = useMemo(() => {
    const nums = PLATFORMS.map(p => data.stats[p.key].total_published);
    return Math.max(...nums, 1);
  }, [data.stats]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 32 }}>
      {PLATFORMS.map(p => {
        const s    = data.stats[p.key];
        const conn = data.connections.find(c => c.platform === p.key);
        return (
          <div key={p.key} style={{
            border: '1px solid var(--border)', padding: '16px 18px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 20 }}>{p.emoji}</span>
              <span style={{ fontFamily: fc, fontWeight: 800, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {p.label}
              </span>
              <ConnectionPill conn={conn} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Stat label="Publicados" value={s.total_published} />
              <Stat label="Últ. 30d"    value={s.published_last_30d} />
              <Stat label="Programados" value={s.scheduled_pending} />
              <Stat label="Fallos 7d"   value={s.failures_7d} danger={s.failures_7d > 0} />
            </div>

            {/* Bar comparing total_published to the max of all platforms */}
            <div style={{ marginTop: 14 }}>
              <div style={{
                height: 8, background: 'var(--bg-1)', border: '1px solid var(--border)',
                position: 'relative',
              }}>
                <div style={{
                  height: '100%',
                  width:  `${Math.round((s.total_published / max) * 100)}%`,
                  background: p.color,
                  transition: 'width 0.3s',
                }} />
              </div>
              <p style={{
                fontFamily: f, fontSize: 10, color: 'var(--text-tertiary)',
                marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                Volumen relativo
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div>
      <p style={{
        fontFamily: f, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
        color: 'var(--text-tertiary)', marginBottom: 2,
      }}>{label}</p>
      <p style={{
        fontFamily: fc, fontSize: 22, fontWeight: 800,
        color: danger ? 'var(--error)' : 'var(--text-primary)',
      }}>{value}</p>
    </div>
  );
}

function ConnectionPill({ conn }: { conn: Connection | undefined }) {
  if (!conn) {
    return <Pill color="#9ca3af" bg="#f3f4f6" label="Sin conectar" />;
  }
  if (conn.status === 'active') {
    return <Pill color="#0D9488" bg="#e6fffa" label="Conectado" icon={<CheckCircle2 size={11} />} />;
  }
  if (conn.status === 'expired') {
    return <Pill color="#b45309" bg="#fef3e8" label="Token expirado" icon={<AlertTriangle size={11} />} />;
  }
  return <Pill color="#dc2626" bg="#fef2f2" label="Error" icon={<XCircle size={11} />} />;
}

function Pill({ color, bg, label, icon }: {
  color: string; bg: string; label: string; icon?: React.ReactNode;
}) {
  return (
    <span style={{
      padding: '2px 8px', background: bg, color, fontFamily: f, fontSize: 10, fontWeight: 700,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      {icon}{label}
    </span>
  );
}

// ─── Platform tab ───────────────────────────────────────────────────────────

function PlatformTab({
  platform, data, onRefresh,
}: {
  platform:   Platform;
  data:       Data;
  onRefresh:  () => void;
}) {
  const meta = PLATFORMS.find(p => p.key === platform)!;
  const conn = data.connections.find(c => c.platform === platform);
  const pubs = data.publications.filter(p => p.platform === platform);
  const sched = data.scheduled.filter(p => p.platform === platform);
  const stats = data.stats[platform];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'flex-start' }}>
      {/* Left: connection + stats */}
      <div>
        <div style={{ border: '1px solid var(--border)', padding: '16px 18px', marginBottom: 16 }}>
          <p style={{
            fontFamily: fc, fontSize: 11, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            color: 'var(--text-tertiary)', marginBottom: 10,
          }}>
            Conexión
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <ConnectionPill conn={conn} />
          </div>
          {conn ? (
            <>
              <p style={{ fontFamily: f, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                {conn.platform_username ? `@${conn.platform_username}` : conn.platform_user_id}
              </p>
              {conn.expires_at && (
                <p style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)' }}>
                  Token expira: {new Date(conn.expires_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              )}
              {conn.last_insights_synced_at && (
                <p style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)' }}>
                  Últimas métricas: {new Date(conn.last_insights_synced_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              )}
            </>
          ) : (
            <p style={{ fontFamily: f, fontSize: 12, color: 'var(--text-tertiary)' }}>
              La marca aún no ha conectado esta plataforma.
            </p>
          )}
        </div>

        <div style={{ border: '1px solid var(--border)', padding: '16px 18px' }}>
          <p style={{
            fontFamily: fc, fontSize: 11, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            color: 'var(--text-tertiary)', marginBottom: 10,
          }}>
            Métricas rápidas
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Stat label="Publicados"  value={stats.total_published} />
            <Stat label="Últ. 30 días" value={stats.published_last_30d} />
            <Stat label="Programados" value={stats.scheduled_pending} />
            <Stat label="Fallos 7d"   value={stats.failures_7d} danger={stats.failures_7d > 0} />
          </div>
        </div>
      </div>

      {/* Right: feed + scheduled */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{
              fontFamily: fc, fontSize: 13, fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              color: 'var(--text-primary)',
            }}>
              Programados ({sched.length})
            </h2>
            <button type="button" onClick={onRefresh}
              style={{
                background: 'transparent', border: '1px solid var(--border)',
                padding: '4px 10px', fontFamily: f, fontSize: 11, cursor: 'pointer',
                color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
              <RefreshCw size={12} /> Refrescar
            </button>
          </div>
          {sched.length === 0 ? (
            <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-tertiary)' }}>
              No hay publicaciones programadas en {meta.label}.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sched.map(p => (
                <ScheduledRow key={p.id} pub={p} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 style={{
            fontFamily: fc, fontSize: 13, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            color: 'var(--text-primary)', marginBottom: 12,
          }}>
            Feed reciente ({pubs.length})
          </h2>
          {pubs.length === 0 ? (
            <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-tertiary)' }}>
              Todavía no hay publicaciones en {meta.label}.
            </p>
          ) : (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8,
            }}>
              {pubs.map(p => (
                <FeedThumb key={p.id} pub={p} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ScheduledRow({ pub }: { pub: Publication }) {
  const when = pub.scheduled_at ? new Date(pub.scheduled_at) : null;
  return (
    <Link
      href={`/posts/${pub.post_id}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', border: '1px solid var(--border)',
        textDecoration: 'none', color: 'inherit', background: 'var(--bg)',
      }}
    >
      {(pub.post?.edited_image_url ?? pub.post?.image_url) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={pub.post!.edited_image_url ?? pub.post!.image_url!}
          alt=""
          style={{ width: 40, height: 40, objectFit: 'cover', flexShrink: 0 }}
        />
      ) : (
        <div style={{
          width: 40, height: 40, background: 'var(--bg-1)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <ImageIcon size={16} style={{ color: 'var(--text-tertiary)' }} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: f, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {pub.post?.caption?.slice(0, 80) ?? '(sin caption)'}
        </p>
        <p style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Clock size={10} />{' '}
          {when ? when.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : 'sin fecha'}
          <span style={{ marginLeft: 8 }}>· {formatTag(pub.post?.format)}</span>
        </p>
      </div>
    </Link>
  );
}

function FeedThumb({ pub }: { pub: Publication }) {
  const href = pub.platform_post_url || `/posts/${pub.post_id}`;
  const external = !!pub.platform_post_url;
  const img  = pub.post?.edited_image_url ?? pub.post?.image_url ?? null;
  const isFailed   = pub.status === 'failed';

  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      style={{
        position: 'relative', display: 'block', aspectRatio: '1',
        border: '1px solid var(--border)', overflow: 'hidden',
        textDecoration: 'none', background: '#000',
      }}
    >
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: isFailed ? 0.4 : 1 }}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: 'var(--bg-1)',
        }}>
          <ImageIcon size={22} style={{ color: 'var(--text-tertiary)' }} />
        </div>
      )}
      {/* Status badge */}
      <span style={{
        position: 'absolute', top: 4, right: 4, padding: '2px 6px',
        background: pub.status === 'published' ? 'rgba(13,148,136,0.9)' :
                    pub.status === 'failed'    ? 'rgba(220,38,38,0.9)'  :
                    pub.status === 'scheduled' ? 'rgba(17,24,39,0.85)'  :
                    'rgba(107,114,128,0.85)',
        color: '#fff', fontFamily: fc, fontSize: 9, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        {pub.status}
      </span>
      {external && (
        <span style={{
          position: 'absolute', bottom: 4, right: 4,
          background: 'rgba(0,0,0,0.6)', padding: 3, color: '#fff',
          display: 'inline-flex',
        }}>
          <ExternalLink size={10} />
        </span>
      )}
    </a>
  );
}

function formatTag(fmt: string | null | undefined): string {
  if (!fmt) return 'foto';
  switch (fmt.toLowerCase()) {
    case 'reel':    case 'reels':    return 'reel';
    case 'video':   case 'videos':   return 'vídeo';
    case 'carousel':case 'carrusel': return 'carrusel';
    case 'story':   case 'stories':  return 'historia';
    case 'image':   case 'foto':     return 'foto';
    default: return fmt;
  }
}

// Silence unused-import warnings for icons only referenced by conditional
// branches above.
void Video; void Layers; void Film;
