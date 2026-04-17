'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Download, ExternalLink, Search, X, LayoutGrid, List } from 'lucide-react';
import toast from 'react-hot-toast';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

type Post = {
  id: string;
  image_url: string | null;
  edited_image_url: string | null;
  caption: string | null;
  hashtags: string[];
  status: string;
  platform: string | string[];
  format: string | null;
  published_at: string | null;
  created_at: string;
  ig_post_id: string | null;
  fb_post_id: string | null;
};

type ViewMode    = 'grid' | 'list';
type FilterRange = 'all' | '3m' | '1m';

const ALL_PLATFORMS: { id: string; label: string }[] = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook',  label: 'Facebook'  },
  { id: 'tiktok',    label: 'TikTok'    },
];

const ACCENT_GREEN = '#0F766E';

const FORMAT_LABELS: Record<string, string> = {
  image: 'Imagen', video: 'Vídeo', reel: 'Reel', carousel: 'Carrusel', story: 'Story',
};

// ── SVG icons ────────────────────────────────────────────────────────────────
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

function getPlatforms(post: Post): string[] {
  return Array.isArray(post.platform) ? post.platform : post.platform ? [post.platform] : [];
}

// ── Grid card ─────────────────────────────────────────────────────────────────
function GridCard({ post }: { post: Post }) {
  const img = post.edited_image_url ?? post.image_url;
  const platforms = getPlatforms(post);
  const date = post.published_at ?? post.created_at;

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

        {/* Gradient */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, transparent 40%, transparent 55%, rgba(0,0,0,0.62) 100%)', pointerEvents: 'none' }} />

        {/* Platform dots — top left */}
        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 4 }}>
          {platforms.map((p) => (
            <span key={p} style={{ width: 22, height: 22, background: ACCENT_GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PlatformIcon platform={p} size={11} color="#fff" />
            </span>
          ))}
        </div>

        {/* External link — top right */}
        {(post.ig_post_id || post.fb_post_id) && (
          <div style={{ position: 'absolute', top: 10, right: 10 }}>
            <span style={{ width: 22, height: 22, background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ExternalLink size={10} color="#fff" />
            </span>
          </div>
        )}

        {/* Bottom info */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 10px 10px' }}>
          {post.format && (
            <span style={{ display: 'inline-block', fontFamily: f, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.6)', marginBottom: 3 }}>
              {FORMAT_LABELS[post.format] ?? post.format}
            </span>
          )}
          <p style={{ fontFamily: f, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.9)', margin: 0 }}>
            {new Date(date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>

        {/* Hover overlay */}
        <div className="hist-grid-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.22s' }}>
          <span className="hist-grid-cta" style={{ fontFamily: fc, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#fff', background: 'var(--accent)', padding: '7px 16px', opacity: 0, transform: 'translateY(6px)', transition: 'opacity 0.22s, transform 0.22s' }}>
            Ver post
          </span>
        </div>
      </div>
    </Link>
  );
}

// ── List row ──────────────────────────────────────────────────────────────────
function ListRow({ post, isLast }: { post: Post; isLast: boolean }) {
  const img = post.edited_image_url ?? post.image_url;
  const platforms = getPlatforms(post);
  const date = post.published_at ?? post.created_at;

  return (
    <Link href={`/posts/${post.id}`} className="hist-list-row" style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px',
      textDecoration: 'none', color: 'inherit', background: 'var(--bg)',
      borderBottom: isLast ? 'none' : '1px solid var(--border)',
    }}>
      {/* Thumbnail */}
      <div style={{ width: 48, height: 48, flexShrink: 0, overflow: 'hidden', background: 'var(--bg-2)', position: 'relative' }}>
        {img
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', imageOrientation: 'from-image' }} />
          : <div style={{ width: '100%', height: '100%', background: 'var(--bg-2)' }} />}
      </div>

      {/* Caption */}
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

      {/* Date + link */}
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

// ── Page ──────────────────────────────────────────────────────────────────────
export default function HistorialPage() {
  const [allPosts,            setAllPosts]            = useState<Post[]>([]);
  const [loading,             setLoading]             = useState(true);
  const [platform,            setPlatform]            = useState('all');
  const [range,               setRange]               = useState<FilterRange>('all');
  const [search,              setSearch]              = useState('');
  const [view,                setView]                = useState<ViewMode>('grid');
  const [subscribedPlatforms, setSubscribedPlatforms] = useState<string[]>([]);

  const load = useCallback((p: string, r: FilterRange) => {
    setLoading(true);
    const params = new URLSearchParams({ status: 'published', range: r });
    if (p !== 'all') params.set('platform', p);
    fetch(`/api/historial?${params}`)
      .then((res) => res.json())
      .then((d) => {
        setAllPosts(d.posts ?? []);
        if (d.subscribedPlatforms) setSubscribedPlatforms(d.subscribedPlatforms);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(platform, range); }, [platform, range, load]);

  const filtered = search.trim()
    ? allPosts.filter((p) =>
        p.caption?.toLowerCase().includes(search.toLowerCase()) ||
        (Array.isArray(p.hashtags) && p.hashtags.some((h) => h.toLowerCase().includes(search.toLowerCase())))
      )
    : allPosts;

  // Stats per platform
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

  return (
    <div className="page-content dashboard-unified-page" style={{ maxWidth: 1060 }}>

      {/* ── Header ── */}
      <div className="dashboard-unified-header" style={{ padding: '32px 0 28px', borderBottom: '1px solid var(--border)', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--accent)', marginBottom: 6 }}>
              Tus publicaciones
            </p>
            <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.4rem, 5vw, 3.4rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: 'var(--text-primary)', lineHeight: 0.92, marginBottom: 0 }}>
              Historial
            </h1>
          </div>
          {allPosts.length > 0 && (
            <button onClick={exportCSV} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontFamily: f, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', transition: 'all 0.15s', flexShrink: 0 }}>
              <Download size={12} /> Exportar CSV
            </button>
          )}
        </div>

        {/* ── Stats strip — only subscribed platforms + total ── */}
        {!loading && allPosts.length > 0 && (
          <div style={{ display: 'flex', gap: 0, marginTop: 24, borderTop: '1px solid var(--border)' }}>
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
              <div key={label} style={{ flex: 1, padding: '16px 0 0', borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none', paddingRight: 20, paddingLeft: i === 0 ? 0 : 20 }}>
                <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 28, lineHeight: 1, color: 'var(--text-primary)', marginBottom: 4 }}>{value}</p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  {icon}
                  <span style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.11em', color: 'var(--text-tertiary)' }}>{label}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Filter toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>

        {/* Platform filter — only subscribed platforms, no "Todas" */}
        {subscribedPlatforms.length > 1 && (
          <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
            {ALL_PLATFORMS.filter((p) => subscribedPlatforms.includes(p.id)).map(({ id, label }, i, arr) => {
              const active = platform === id;
              return (
                <button key={id} type="button" onClick={() => setPlatform(platform === id ? 'all' : id)} style={{
                  padding: '7px 13px', border: 'none',
                  borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer',
                  background: active ? ACCENT_GREEN : 'transparent',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                  display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'all 0.14s',
                  whiteSpace: 'nowrap',
                }}>
                  <PlatformIcon platform={id} size={10} color={active ? '#fff' : 'var(--text-secondary)'} />
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Range */}
        <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
          {([['all', 'Todo'], ['3m', '3 meses'], ['1m', '1 mes']] as [FilterRange, string][]).map(([val, lbl], i, arr) => (
            <button key={val} type="button" onClick={() => setRange(val)} style={{
              padding: '7px 12px', border: 'none', borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer',
              background: range === val ? '#111827' : 'transparent',
              color: range === val ? '#fff' : 'var(--text-secondary)',
              fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
              transition: 'all 0.14s', whiteSpace: 'nowrap',
            }}>
              {lbl}
            </button>
          ))}
        </div>

        {/* Search */}
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

        {/* View toggle */}
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

      {/* ── Content ── */}
      {loading ? (
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
            <button type="button" onClick={() => { setPlatform('all'); setRange('all'); setSearch(''); }} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '9px 22px', fontFamily: f, fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
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

      {/* Styles */}
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
