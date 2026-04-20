'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Camera, Download, ExternalLink, LayoutGrid, List, RefreshCw, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

// ── Types ─────────────────────────────────────────────────────────────────────
type Platform    = 'instagram' | 'facebook' | 'tiktok';
type ViewMode    = 'grid' | 'list';
type FilterRange = 'all' | '3m' | '1m';
type PageMode    = 'pipeline' | 'historial';

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

type Post = {
  id:               string;
  image_url:        string | null;
  edited_image_url: string | null;
  caption:          string | null;
  hashtags:         string[];
  status:           string;
  platform:         string | string[];
  format:           string | null;
  published_at:     string | null;
  created_at:       string;
  ig_post_id:       string | null;
  fb_post_id:       string | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────
const PLATFORMS_META: Record<Platform, { label: string; connectHref: string }> = {
  instagram: { label: 'Instagram', connectHref: '/settings#redes' },
  facebook:  { label: 'Facebook',  connectHref: '/settings#redes' },
  tiktok:    { label: 'TikTok',    connectHref: '/settings#redes' },
};

const STATUS_COLOR: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: 'Pendiente',  color: '#78350f', bg: '#fef3c7' },
  scheduled:  { label: 'Programado', color: '#1e40af', bg: '#dbeafe' },
  publishing: { label: 'Publicando', color: '#5b21b6', bg: '#ede9fe' },
  failed:     { label: 'Fallido',    color: '#991b1b', bg: '#fee2e2' },
};

const ALL_PLATFORMS: { id: string; label: string }[] = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook',  label: 'Facebook'  },
  { id: 'tiktok',    label: 'TikTok'    },
];

const ACCENT_GREEN = '#0F766E';

const FORMAT_LABELS: Record<string, string> = {
  image: 'Imagen', video: 'Vídeo', reel: 'Reel', carousel: 'Carrusel', story: 'Story',
};

// ── SVG Icons ─────────────────────────────────────────────────────────────────
function InstagramIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r="0.5" fill={color} stroke="none"/>
    </svg>
  );
}

function FacebookIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>
    </svg>
  );
}

function TikTokIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/>
    </svg>
  );
}

function PlatformIcon({ platform, size = 12, color = 'currentColor' }: { platform: string; size?: number; color?: string }) {
  if (platform === 'instagram') return <InstagramIcon size={size} color={color} />;
  if (platform === 'facebook')  return <FacebookIcon  size={size} color={color} />;
  if (platform === 'tiktok')    return <TikTokIcon    size={size} color={color} />;
  return null;
}

function getPostPlatforms(post: Post): string[] {
  return Array.isArray(post.platform) ? post.platform : post.platform ? [post.platform] : [];
}

// ── Historial: Grid Card ───────────────────────────────────────────────────────
function GridCard({ post }: { post: Post }) {
  const img       = post.edited_image_url ?? post.image_url;
  const platforms = getPostPlatforms(post);
  const date      = post.published_at ?? post.created_at;

  return (
    <Link href={`/posts/${post.id}`} className="hist-grid-card" style={{ display: 'block', textDecoration: 'none', color: 'inherit', position: 'relative' }}>
      <div style={{ aspectRatio: '1', overflow: 'hidden', position: 'relative', background: '#0a0a0a' }}>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" className="hist-grid-img" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', imageOrientation: 'from-image' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-2)' }}>
            <span style={{ fontFamily: fc, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>Sin imagen</span>
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, transparent 40%, transparent 55%, rgba(0,0,0,0.62) 100%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 4 }}>
          {platforms.map((p) => (
            <span key={p} style={{ width: 22, height: 22, background: ACCENT_GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PlatformIcon platform={p} size={11} color="#fff" />
            </span>
          ))}
        </div>
        {(post.ig_post_id || post.fb_post_id) && (
          <div style={{ position: 'absolute', top: 10, right: 10 }}>
            <span style={{ width: 22, height: 22, background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ExternalLink size={10} color="#fff" />
            </span>
          </div>
        )}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px' }}>
          {post.format && (
            <span style={{ display: 'inline-block', fontFamily: f, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.6)', marginBottom: 3 }}>
              {FORMAT_LABELS[post.format] ?? post.format}
            </span>
          )}
          <p style={{ fontFamily: f, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.9)', margin: 0 }}>
            {new Date(date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="hist-grid-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.22s' }}>
          <span className="hist-grid-cta" style={{ fontFamily: fc, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#fff', background: 'var(--accent)', padding: '7px 16px', opacity: 0, transform: 'translateY(6px)', transition: 'opacity 0.22s, transform 0.22s' }}>
            Ver post
          </span>
        </div>
      </div>
    </Link>
  );
}

// ── Historial: List Row ────────────────────────────────────────────────────────
function ListRow({ post, isLast }: { post: Post; isLast: boolean }) {
  const img       = post.edited_image_url ?? post.image_url;
  const platforms = getPostPlatforms(post);
  const date      = post.published_at ?? post.created_at;

  return (
    <Link href={`/posts/${post.id}`} className="hist-list-row" style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px',
      textDecoration: 'none', color: 'inherit', background: 'var(--bg)',
      borderBottom: isLast ? 'none' : '1px solid var(--border)',
    }}>
      <div style={{ width: 48, height: 48, flexShrink: 0, overflow: 'hidden', background: 'var(--bg-2)' }}>
        {img
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', imageOrientation: 'from-image' }} />
          : <div style={{ width: '100%', height: '100%', background: 'var(--bg-2)' }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 5 }}>
          {post.caption ? post.caption.slice(0, 90) : <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Sin descripción</span>}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {platforms.map((p) => {
            const meta = ALL_PLATFORMS.find((x) => x.id === p);
            return meta ? (
              <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', background: `${ACCENT_GREEN}18`, fontFamily: f, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: ACCENT_GREEN }}>
                <PlatformIcon platform={p} size={9} color={ACCENT_GREEN} />
                {meta.label}
              </span>
            ) : null;
          })}
          {post.format && (
            <span style={{ fontFamily: f, fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500 }}>
              {FORMAT_LABELS[post.format] ?? post.format}
            </span>
          )}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{ fontFamily: f, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>
          {new Date(date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
        {(post.ig_post_id || post.fb_post_id) && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: f, fontSize: 9, color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            <ExternalLink size={9} /> Ver publicado
          </span>
        )}
      </div>
    </Link>
  );
}

// ── Queued Section ─────────────────────────────────────────────────────────────
function QueuedSection({ platform, queued }: { platform: Platform; queued: Queued[] }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontFamily: fc, fontSize: 16, fontWeight: 800, letterSpacing: '0.01em', color: 'var(--text-primary)', marginBottom: 8 }}>
        Publicaciones pendientes ({queued.length})
      </h2>
      <p style={{ fontFamily: f, fontSize: 13, color: '#6b7280', marginBottom: 14 }}>
        Contenido programado y solicitudes en proceso de publicación.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {queued.map(q => (
          <Link key={q.id} href={`/posts/${q.postId}`} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
            border: '1px solid var(--border)', background: 'var(--bg)',
            textDecoration: 'none', color: 'inherit', borderRadius: 6,
          }}>
            {q.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={q.imageUrl} alt="" style={{ width: 44, height: 44, objectFit: 'cover', flexShrink: 0, borderRadius: 4 }} />
            ) : (
              <div style={{ width: 44, height: 44, background: 'var(--bg-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: 4 }}>
                <Camera size={18} style={{ color: 'var(--text-tertiary)' }} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: f, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {q.caption ? q.caption.slice(0, 60) : `Publicación para feed${q.imageUrl ? ' (imagen)' : ''}`}
              </p>
              <p style={{ fontFamily: f, fontSize: 12, color: '#6b7280', margin: 0 }}>
                {PLATFORMS_META[platform].label} · {q.scheduledAt
                  ? new Date(q.scheduledAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
                  : 'Sin fecha programada'}
              </p>
            </div>
            <span style={{
              padding: '2px 8px', flexShrink: 0,
              background: STATUS_COLOR[q.status]?.bg ?? '#f3f4f6',
              color: STATUS_COLOR[q.status]?.color ?? '#4b5563',
              fontFamily: f, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              {STATUS_COLOR[q.status]?.label ?? q.status}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ── Platform Panel ─────────────────────────────────────────────────────────────
function PlatformPanel({ data }: { data: FeedData }) {
  const meta = PLATFORMS_META[data.platform];

  if (!data.connected) {
    return (
      <div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 24px', textAlign: 'center', border: '1px solid var(--border)', marginBottom: 32 }}>
          <h2 style={{ fontFamily: fc, fontWeight: 900, fontSize: '1.6rem', textTransform: 'uppercase', color: 'var(--ink)', marginBottom: 10 }}>
            {meta.label} no conectado
          </h2>
          <p style={{ fontFamily: f, fontSize: 14, color: 'var(--muted)', maxWidth: 420, lineHeight: 1.7, marginBottom: 24 }}>
            Conecta tu cuenta para ver tu feed real de {meta.label}. Mientras tanto, las publicaciones que hayas programado seguirán visibles abajo.
          </p>
          <Link href={meta.connectHref} style={{ padding: '10px 22px', background: '#0F766E', color: '#fff', textDecoration: 'none', fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Conectar {meta.label}
          </Link>
        </div>
        {data.queued.length > 0 && <QueuedSection platform={data.platform} queued={data.queued} />}
      </div>
    );
  }

  return (
    <div>
      <div style={{ padding: '12px 16px', border: '1px solid var(--border)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0D9488' }} />
        <span style={{ fontFamily: f, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          {data.username ? `@${data.username}` : meta.label}
        </span>
        <span style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
          {data.published.length > 0 ? `${data.published.length} publicados` : 'Sin publicaciones en el feed'}
        </span>
      </div>
      {data.queued.length > 0 && <QueuedSection platform={data.platform} queued={data.queued} />}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: fc, fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-primary)', marginBottom: 12 }}>
          Publicados en {meta.label}
        </h2>
        {data.published.length === 0 ? (
          <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-tertiary)' }}>
            {data.platform === 'tiktok'
              ? 'El feed público de TikTok aún no está disponible vía API. Se conectará cuando aprueben el scope research.'
              : `No encontramos publicaciones en ${meta.label} todavía.`}
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
            {data.published.map(p => (
              <a key={p.id} href={p.permalink ?? '#'} target="_blank" rel="noopener noreferrer" style={{ position: 'relative', display: 'block', aspectRatio: '1', border: '1px solid var(--border)', overflow: 'hidden', background: '#000', textDecoration: 'none' }}>
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-1)', fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)' }}>Sin imagen</div>
                )}
                {p.permalink && (
                  <span style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', padding: 3, color: '#fff', display: 'inline-flex' }}>
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

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function FeedPage() {
  const searchParams = useSearchParams();
  const initialTab  = (searchParams.get('platform') as Platform | null) ?? 'instagram';
  const initialMode = searchParams.get('tab') === 'historial' ? 'historial' : 'pipeline';

  const [mode, setMode] = useState<PageMode>(initialMode as PageMode);

  // Pipeline state
  const [tab, setTab]               = useState<Platform>(
    (['instagram', 'facebook', 'tiktok'] as const).includes(initialTab as Platform) ? initialTab as Platform : 'instagram',
  );
  const [cache, setCache]           = useState<Partial<Record<Platform, FeedData>>>({});
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError]     = useState<string | null>(null);

  // Historial state
  const [allPosts,            setAllPosts]            = useState<Post[]>([]);
  const [histLoading,         setHistLoading]         = useState(false);
  const [histPlatform,        setHistPlatform]        = useState('all');
  const [range,               setRange]               = useState<FilterRange>('all');
  const [search,              setSearch]              = useState('');
  const [view,                setView]                = useState<ViewMode>('grid');
  const [subscribedPlatforms, setSubscribedPlatforms] = useState<string[]>([]);

  // ── Feed logic ────────────────────────────────────────────────────────────────
  async function loadTab(p: Platform, force = false) {
    if (!force && cache[p]) return;
    setFeedLoading(true);
    setFeedError(null);
    try {
      const res  = await fetch(`/api/feed/${p}`);
      const json = await res.json() as FeedData & { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Error cargando feed');
      setCache(prev => ({ ...prev, [p]: json }));
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setFeedLoading(false);
    }
  }

  useEffect(() => {
    if (mode === 'pipeline') loadTab(tab);
  }, [tab, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Historial logic ────────────────────────────────────────────────────────────
  const loadHistorial = useCallback((p: string, r: FilterRange) => {
    setHistLoading(true);
    const params = new URLSearchParams({ status: 'published', range: r });
    if (p !== 'all') params.set('platform', p);
    fetch(`/api/historial?${params}`)
      .then((res) => res.json())
      .then((d) => {
        setAllPosts(d.posts ?? []);
        if (d.subscribedPlatforms) setSubscribedPlatforms(d.subscribedPlatforms);
        setHistLoading(false);
      })
      .catch(() => setHistLoading(false));
  }, []);

  useEffect(() => {
    if (mode === 'historial') loadHistorial(histPlatform, range);
  }, [mode, histPlatform, range, loadHistorial]);

  const filtered = search.trim()
    ? allPosts.filter((p) =>
        p.caption?.toLowerCase().includes(search.toLowerCase()) ||
        (Array.isArray(p.hashtags) && p.hashtags.some((h) => h.toLowerCase().includes(search.toLowerCase())))
      )
    : allPosts;

  const byPlatform = (pid: string) =>
    allPosts.filter((p) => {
      const arr = Array.isArray(p.platform) ? p.platform : [p.platform ?? ''];
      return arr.includes(pid);
    }).length;

  async function exportCSV() {
    const res = await fetch('/api/historial/export');
    if (!res.ok) { toast.error('Error al exportar'); return; }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'historial.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const feedData = cache[tab];

  return (
    <div className="page-content dashboard-unified-page" style={{ maxWidth: 1060 }}>

      {/* ── Header ── */}
      <div className="dashboard-unified-header" style={{ padding: '48px 0 32px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: '#111827', lineHeight: 0.95, marginBottom: 8 }}>
            Feed
          </h1>
          <p style={{ color: '#6b7280', fontSize: 15, fontFamily: f }}>
            Gestiona tu pipeline de publicaciones y consulta tu historial desde un solo lugar.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {mode === 'historial' && allPosts.length > 0 && (
            <button onClick={exportCSV} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontFamily: f, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              <Download size={12} /> Exportar CSV
            </button>
          )}
          {mode === 'pipeline' && (
            <button type="button" onClick={() => loadTab(tab, true)} disabled={feedLoading} style={{ padding: '8px 16px', background: '#ffffff', border: '1px solid #d1d5db', fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: feedLoading ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, color: '#374151' }}>
              <RefreshCw size={12} /> Actualizar
            </button>
          )}
        </div>
      </div>

      {/* ── Mode toggle ── */}
      <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 24, width: 'fit-content' }}>
        {([['pipeline', 'Pipeline en vivo'], ['historial', 'Historial']] as [PageMode, string][]).map(([m, label], i) => (
          <button key={m} type="button" onClick={() => setMode(m)} style={{
            padding: '10px 24px', border: 'none', cursor: 'pointer',
            borderRight: i === 0 ? '1px solid var(--border)' : 'none',
            background: mode === m ? '#111827' : 'transparent',
            color: mode === m ? '#fff' : 'var(--text-secondary)',
            fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
            transition: 'all 0.14s',
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* ══════════ PIPELINE MODE ══════════ */}
      {mode === 'pipeline' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)', marginBottom: 20 }}>
            {(['instagram', 'facebook', 'tiktok'] as const).map(p => {
              const meta      = PLATFORMS_META[p];
              const pData     = cache[p];
              const active    = tab === p;
              const connected = pData?.connected ?? null;
              return (
                <button key={p} onClick={() => setTab(p)} style={{ padding: '24px 20px', background: active ? 'var(--accent)' : '#ffffff', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <PlatformIcon platform={p} size={18} color={active ? '#ffffff' : 'var(--accent)'} />
                    {connected !== null && (
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? '#0D9488' : '#9ca3af', flexShrink: 0 }} />
                    )}
                  </div>
                  <p style={{ fontFamily: fc, fontWeight: 800, fontSize: 15, textTransform: 'uppercase', color: active ? '#ffffff' : '#111827', marginBottom: 4 }}>
                    {meta.label}
                  </p>
                  <p style={{ fontFamily: f, fontSize: 12, color: active ? 'rgba(255,255,255,0.5)' : '#9ca3af' }}>
                    {connected === null ? 'Cargando...' : connected ? (pData?.username ? `@${pData.username}` : 'Conectado') : 'No conectado'}
                  </p>
                </button>
              );
            })}
          </div>

          {feedLoading && !feedData && <p style={{ fontFamily: f, color: 'var(--muted)' }}>Cargando feed…</p>}
          {feedError && (
            <div style={{ padding: 16, border: '1px solid #fca5a5', background: '#fef2f2', fontFamily: f, fontSize: 13, color: '#991b1b', marginBottom: 16 }}>
              {feedError}
            </div>
          )}
          {feedData && <PlatformPanel data={feedData} />}
        </>
      )}

      {/* ══════════ HISTORIAL MODE ══════════ */}
      {mode === 'historial' && (
        <>
          {!histLoading && allPosts.length > 0 && (
            <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
              {[
                { label: 'Total', value: allPosts.length, icon: null },
                ...ALL_PLATFORMS
                  .filter((p) => subscribedPlatforms.includes(p.id))
                  .map((p) => ({
                    label: p.label,
                    value: byPlatform(p.id),
                    icon: <PlatformIcon platform={p.id} size={11} color={ACCENT_GREEN} />,
                  })),
              ].map(({ label, value, icon }, i, arr) => (
                <div key={label} style={{ flex: 1, padding: '16px 0', borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none', paddingRight: 20, paddingLeft: i === 0 ? 0 : 20 }}>
                  <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 28, lineHeight: 1, color: 'var(--text-primary)', marginBottom: 4 }}>{value}</p>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {icon}
                    <span style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.11em', color: 'var(--text-tertiary)' }}>{label}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Filter toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {subscribedPlatforms.length > 1 && (
              <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
                {ALL_PLATFORMS.filter((p) => subscribedPlatforms.includes(p.id)).map(({ id, label }, i, arr) => {
                  const active = histPlatform === id;
                  return (
                    <button key={id} type="button" onClick={() => setHistPlatform(histPlatform === id ? 'all' : id)} style={{
                      padding: '7px 13px', border: 'none',
                      borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                      cursor: 'pointer',
                      background: active ? ACCENT_GREEN : 'transparent',
                      color: active ? '#fff' : 'var(--text-secondary)',
                      fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                      display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'all 0.14s', whiteSpace: 'nowrap',
                    }}>
                      <PlatformIcon platform={id} size={10} color={active ? '#fff' : 'var(--text-secondary)'} />
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
              {([['all', 'Todo'], ['3m', '3 meses'], ['1m', '1 mes']] as [FilterRange, string][]).map(([val, lbl], i, arr) => (
                <button key={val} type="button" onClick={() => setRange(val)} style={{
                  padding: '7px 12px', border: 'none',
                  borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer',
                  background: range === val ? '#111827' : 'transparent',
                  color: range === val ? '#fff' : 'var(--text-secondary)',
                  fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                  transition: 'all 0.14s', whiteSpace: 'nowrap',
                }}>
                  {lbl}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, minWidth: 150, position: 'relative' }}>
              <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Buscar caption o hashtag…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '100%', padding: '7px 30px 7px 28px', border: '1px solid var(--border)', background: 'var(--bg)', fontFamily: f, fontSize: 12, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2, display: 'flex' }}>
                  <X size={12} />
                </button>
              )}
            </div>
            <div style={{ display: 'flex', border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
              {([['grid', LayoutGrid], ['list', List]] as [ViewMode, typeof LayoutGrid][]).map(([v, Icon], i) => (
                <button key={v} type="button" onClick={() => setView(v)} style={{
                  padding: '7px 10px', border: 'none', cursor: 'pointer',
                  background: view === v ? '#111827' : 'transparent',
                  color: view === v ? '#fff' : 'var(--text-tertiary)',
                  borderRight: i === 0 ? '1px solid var(--border)' : 'none',
                  transition: 'all 0.14s', display: 'flex', alignItems: 'center',
                }}>
                  <Icon size={14} />
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          {histLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} style={{ aspectRatio: '1', background: 'var(--bg-1)', opacity: 1 - i * 0.07 }} className="hist-skeleton" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ border: '1px solid var(--border)', background: 'var(--bg)', padding: '80px 20px', textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, background: 'var(--bg-1)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Search size={20} style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 22, textTransform: 'uppercase', color: 'var(--text-primary)', letterSpacing: '0.02em', marginBottom: 8 }}>
                {allPosts.length === 0 ? 'Historial vacío' : 'Sin resultados'}
              </p>
              <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-tertiary)', maxWidth: 340, margin: '0 auto 28px', lineHeight: 1.7 }}>
                {allPosts.length === 0
                  ? 'Aquí aparecerán todas las publicaciones que realices en tus redes sociales.'
                  : 'No hay publicaciones que coincidan con los filtros actuales.'}
              </p>
              {allPosts.length === 0 ? (
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Link href="/posts/new" style={{ background: '#111827', color: '#fff', padding: '10px 24px', textDecoration: 'none', fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    + Crear primer post
                  </Link>
                  <Link href="/posts" style={{ background: 'var(--bg)', color: 'var(--text-primary)', padding: '10px 24px', textDecoration: 'none', fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)' }}>
                    Ver posts
                  </Link>
                </div>
              ) : (
                <button type="button" onClick={() => { setHistPlatform('all'); setRange('all'); setSearch(''); }} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '9px 22px', fontFamily: f, fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : view === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }} className="hist-grid">
              {filtered.map((post) => <GridCard key={post.id} post={post} />)}
            </div>
          ) : (
            <div style={{ border: '1px solid var(--border)', overflow: 'hidden' }}>
              {filtered.map((post, i) => <ListRow key={post.id} post={post} isLast={i === filtered.length - 1} />)}
            </div>
          )}
        </>
      )}

      <style>{`
        .hist-grid-img { image-orientation: from-image; transition: transform 0.4s ease; }
        .hist-grid-card:hover .hist-grid-img { transform: scale(1.05); }
        .hist-grid-card:hover .hist-grid-overlay { background: rgba(0,0,0,0.22) !important; }
        .hist-grid-card:hover .hist-grid-cta { opacity: 1 !important; transform: translateY(0) !important; }
        .hist-list-row:hover { background: var(--bg-1) !important; }
        @keyframes hist-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .hist-skeleton { animation: hist-pulse 1.6s ease-in-out infinite; }
        @media (max-width: 640px) {
          .hist-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
