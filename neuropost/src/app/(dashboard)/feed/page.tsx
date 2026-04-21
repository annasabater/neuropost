'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Calendar, Download, ExternalLink, LayoutGrid, List, RefreshCw, Search, TrendingUp, X } from 'lucide-react';
import toast from 'react-hot-toast';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

// ── Types ─────────────────────────────────────────────────────────────────────
type Platform    = 'instagram' | 'facebook' | 'tiktok';
type ViewMode    = 'grid' | 'list';
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

interface PostMetrics {
  reach:           number | null;
  impressions:     number | null;
  likes:           number | null;
  comments:        number | null;
  saves:           number | null;
  shares:          number | null;
  engagement_rate: number | null;
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
  metrics?:         PostMetrics | null;
};

interface DashboardMetrics {
  thisWeek: {
    posts: number; impressions: number; reach: number; likes: number;
    comments: number; saves: number; shares: number; engagementRate: number;
    bestHour: number | null;
  };
  changes: { impressions: number | null; reach: number | null; engagement: number | null; posts: number | null };
  counts:  { pending: number; scheduled: number };
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PLATFORMS_META: Record<Platform, { label: string; connectHref: string }> = {
  instagram: { label: 'Instagram', connectHref: '/settings#redes' },
  facebook:  { label: 'Facebook',  connectHref: '/settings#redes' },
  tiktok:    { label: 'TikTok',    connectHref: '/settings#redes' },
};

const ALL_PLATFORMS: { id: Platform; label: string }[] = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook',  label: 'Facebook'  },
  { id: 'tiktok',    label: 'TikTok'    },
];

const ACCENT = '#0F766E';
const ACCENT_2 = '#0D9488';

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

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function fmtDelta(pct: number | null): { text: string; color: string } | null {
  if (pct == null) return null;
  if (pct > 0) return { text: `↑ ${pct}%`, color: '#059669' };
  if (pct < 0) return { text: `↓ ${Math.abs(pct)}%`, color: '#dc2626' };
  return { text: '— 0%', color: '#9ca3af' };
}

function fmtScheduledDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  if (sameDay(d, today))    return `HOY · ${time}`;
  if (sameDay(d, tomorrow)) return `MAÑANA · ${time}`;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).toUpperCase() + ` · ${time}`;
}

// ── KPI strip ────────────────────────────────────────────────────────────────
function KpiStrip({ items }: { items: Array<{ label: string; value: string; delta?: { text: string; color: string } | null; meta?: string }> }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, border: '1px solid #e5e7eb', background: '#fff', marginBottom: 28 }}>
      {items.map((it, i) => (
        <div key={it.label} style={{ padding: '18px 22px', borderRight: i < items.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
          <p style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9ca3af', margin: '0 0 10px' }}>{it.label}</p>
          <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 30, letterSpacing: '-0.02em', lineHeight: 1, color: '#111827', margin: 0 }}>{it.value}</p>
          {it.delta && (
            <p style={{ fontFamily: f, fontSize: 11, fontWeight: 600, color: it.delta.color, margin: '8px 0 0' }}>{it.delta.text}</p>
          )}
          {it.meta && !it.delta && (
            <p style={{ fontFamily: f, fontSize: 11, color: '#9ca3af', margin: '8px 0 0' }}>{it.meta}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Feed preview grid (published + scheduled interleaved) ────────────────────
type GridItem =
  | { kind: 'published'; id: string; imageUrl: string | null; caption: string | null; permalink: string | null; timestamp: string }
  | { kind: 'scheduled'; id: string; postId: string; imageUrl: string | null; caption: string | null; scheduledAt: string | null; status: string };

function FeedPreviewGrid({ items, onlyUpcoming }: { items: GridItem[]; onlyUpcoming: boolean }) {
  const filtered = onlyUpcoming ? items.filter(i => i.kind === 'scheduled') : items;

  if (filtered.length === 0) {
    return (
      <div style={{ padding: '60px 24px', border: '1px solid #e5e7eb', background: '#fff', textAlign: 'center' }}>
        <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 18, textTransform: 'uppercase', color: '#111827', marginBottom: 8 }}>Sin publicaciones todavía</p>
        <p style={{ fontFamily: f, fontSize: 13, color: '#9ca3af', marginBottom: 20 }}>
          {onlyUpcoming ? 'No hay contenido programado para esta red.' : 'Crea tu primer post para ver el feed.'}
        </p>
        <Link href="/posts/new" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: ACCENT, color: '#fff', textDecoration: 'none', fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          + Crear publicación
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, background: '#e5e7eb', border: '1px solid #e5e7eb' }}>
      {filtered.map(it => {
        const img = it.imageUrl;
        const isScheduled = it.kind === 'scheduled';
        const href = isScheduled ? `/posts/${it.postId}` : (it.permalink ?? `/posts/${it.id}`);
        const external = !isScheduled && !!it.permalink;

        const tile = (
          <div style={{ position: 'relative', aspectRatio: '1', background: '#000', overflow: 'hidden' }}>
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', imageOrientation: 'from-image', opacity: isScheduled ? 0.88 : 1 }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', fontFamily: f, fontSize: 11, color: '#9ca3af' }}>Sin imagen</div>
            )}

            {isScheduled && (
              <>
                <div style={{ position: 'absolute', inset: 0, border: `2px solid ${ACCENT_2}`, pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', top: 8, left: 8, background: ACCENT, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Calendar size={9} color="#fff" />
                  <span style={{ fontFamily: f, fontSize: 9, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Programado</span>
                </div>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)', padding: '18px 10px 8px' }}>
                  <p style={{ fontFamily: f, fontSize: 10, fontWeight: 700, color: '#fff', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {fmtScheduledDate(it.scheduledAt)}
                  </p>
                </div>
              </>
            )}
            {!isScheduled && external && (
              <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.55)', padding: 4, display: 'inline-flex' }}>
                <ExternalLink size={10} color="#fff" />
              </div>
            )}
          </div>
        );

        return external ? (
          <a key={`${it.kind}-${it.id}`} href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>{tile}</a>
        ) : (
          <Link key={`${it.kind}-${it.id}`} href={href} style={{ textDecoration: 'none', display: 'block' }}>{tile}</Link>
        );
      })}
    </div>
  );
}

// ── Week timeline ────────────────────────────────────────────────────────────
function WeekTimeline({ scheduled }: { scheduled: Queued[] }) {
  const today = new Date();
  const monday = new Date(today);
  const day = monday.getDay();
  monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    const next = new Date(d); next.setDate(d.getDate() + 1);
    const items = scheduled.filter(q => {
      if (!q.scheduledAt) return false;
      const t = new Date(q.scheduledAt).getTime();
      return t >= d.getTime() && t < next.getTime();
    });
    return { date: d, items, isToday: d.toDateString() === today.toDateString() };
  });

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontFamily: fc, fontSize: 14, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#111827', margin: 0 }}>Esta semana</h2>
        <p style={{ fontFamily: f, fontSize: 11, color: '#9ca3af', margin: 0 }}>
          {monday.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} – {new Date(monday.getTime() + 6 * 86400000).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, background: '#e5e7eb', border: '1px solid #e5e7eb' }}>
        {days.map(({ date, items, isToday }) => (
          <div key={date.toISOString()} style={{ background: isToday ? '#f0fdfa' : '#fff', minHeight: 130, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontFamily: f, fontSize: 9, fontWeight: 600, color: isToday ? ACCENT : '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {isToday ? 'Hoy' : date.toLocaleDateString('es-ES', { weekday: 'short' }).slice(0, 3)}
              </span>
              <span style={{ fontFamily: fc, fontSize: 18, fontWeight: 900, color: isToday ? ACCENT : '#111827', lineHeight: 1 }}>{date.getDate()}</span>
            </div>
            {items.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: f, fontSize: 10, color: '#d1d5db' }}>—</span>
              </div>
            ) : (
              items.slice(0, 3).map(q => (
                <Link key={q.id} href={`/posts/${q.postId}`} style={{ position: 'relative', display: 'block', aspectRatio: '1', background: '#f3f4f6', textDecoration: 'none' }}>
                  {q.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={q.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : null}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.65)', padding: '2px 4px' }}>
                    <span style={{ fontFamily: f, fontSize: 8, fontWeight: 700, color: '#fff', letterSpacing: '0.05em' }}>
                      {q.scheduledAt ? new Date(q.scheduledAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                </Link>
              ))
            )}
            {items.length > 3 && (
              <span style={{ fontFamily: f, fontSize: 10, color: '#6b7280', textAlign: 'center', marginTop: 2 }}>+{items.length - 3}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Historial: top performer card ────────────────────────────────────────────
function TopCard({ post, rank }: { post: Post; rank: number }) {
  const img = post.edited_image_url ?? post.image_url;
  const m   = post.metrics;
  const platforms = getPostPlatforms(post);
  return (
    <Link href={`/posts/${post.id}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit', border: '1px solid #e5e7eb', background: '#fff' }}>
      <div style={{ position: 'relative', aspectRatio: '16/10', background: '#000', overflow: 'hidden' }}>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : null}
        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ background: '#111827', color: '#fff', fontFamily: fc, fontSize: 10, fontWeight: 900, padding: '3px 8px', letterSpacing: '0.08em' }}>#{rank}</span>
          {platforms.map(p => (
            <span key={p} style={{ width: 22, height: 22, background: ACCENT, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <PlatformIcon platform={p} size={11} color="#fff" />
            </span>
          ))}
        </div>
      </div>
      <div style={{ padding: '14px 16px' }}>
        <p style={{ fontFamily: f, fontSize: 12, color: '#111827', lineHeight: 1.4, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {post.caption ? post.caption.slice(0, 110) : <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Sin descripción</span>}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 14, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
          <div>
            <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 18, color: '#111827', margin: 0, lineHeight: 1 }}>{fmtNum(m?.reach ?? 0)}</p>
            <p style={{ fontFamily: f, fontSize: 9, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '4px 0 0' }}>Alcance</p>
          </div>
          <div>
            <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 18, color: '#111827', margin: 0, lineHeight: 1 }}>{fmtNum(m?.likes ?? 0)}</p>
            <p style={{ fontFamily: f, fontSize: 9, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '4px 0 0' }}>Likes</p>
          </div>
          <div>
            <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 18, color: ACCENT, margin: 0, lineHeight: 1 }}>{m?.engagement_rate != null ? `${m.engagement_rate.toFixed(1)}%` : '—'}</p>
            <p style={{ fontFamily: f, fontSize: 9, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '4px 0 0' }}>Engagement</p>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Historial grid card (with inline metrics) ────────────────────────────────
function HistorialGridCard({ post }: { post: Post }) {
  const img       = post.edited_image_url ?? post.image_url;
  const platforms = getPostPlatforms(post);
  const date      = post.published_at ?? post.created_at;
  const m         = post.metrics;
  return (
    <Link href={`/posts/${post.id}`} className="hist-grid-card" style={{ display: 'block', textDecoration: 'none', color: 'inherit', position: 'relative', background: '#000' }}>
      <div style={{ aspectRatio: '1', overflow: 'hidden', position: 'relative' }}>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" className="hist-grid-img" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', imageOrientation: 'from-image' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1f2937' }}>
            <span style={{ fontFamily: fc, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6b7280' }}>Sin imagen</span>
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 32%, transparent 55%, rgba(0,0,0,0.72) 100%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 4 }}>
          {platforms.map(p => (
            <span key={p} style={{ width: 22, height: 22, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PlatformIcon platform={p} size={11} color="#fff" />
            </span>
          ))}
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 12px', color: '#fff' }}>
          {m ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontFamily: fc, fontWeight: 900, fontSize: 16, lineHeight: 1 }}>{fmtNum(m.reach ?? 0)}</span>
              <span style={{ fontFamily: f, fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>alcance</span>
              {m.engagement_rate != null && (
                <span style={{ marginLeft: 'auto', fontFamily: fc, fontWeight: 900, fontSize: 14, color: '#5eead4' }}>{m.engagement_rate.toFixed(1)}%</span>
              )}
            </div>
          ) : (
            <p style={{ fontFamily: f, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)', margin: 0 }}>
              {new Date(date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Historial list row ───────────────────────────────────────────────────────
function HistorialListRow({ post, isLast }: { post: Post; isLast: boolean }) {
  const img       = post.edited_image_url ?? post.image_url;
  const platforms = getPostPlatforms(post);
  const date      = post.published_at ?? post.created_at;
  const m         = post.metrics;
  return (
    <Link href={`/posts/${post.id}`} className="hist-list-row" style={{
      display: 'grid', gridTemplateColumns: '56px 1fr auto auto', gap: 16, alignItems: 'center', padding: '14px 16px',
      textDecoration: 'none', color: 'inherit', background: '#fff',
      borderBottom: isLast ? 'none' : '1px solid #f3f4f6',
    }}>
      <div style={{ width: 56, height: 56, background: '#f3f4f6' }}>
        {img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontFamily: f, fontSize: 13, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 5, margin: 0 }}>
          {post.caption ? post.caption.slice(0, 90) : <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Sin descripción</span>}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
          {platforms.map(p => (
            <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', background: `${ACCENT}15`, fontFamily: f, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: ACCENT }}>
              <PlatformIcon platform={p} size={9} color={ACCENT} /> {ALL_PLATFORMS.find(x => x.id === p)?.label}
            </span>
          ))}
          {post.format && (
            <span style={{ fontFamily: f, fontSize: 10, color: '#9ca3af' }}>{FORMAT_LABELS[post.format] ?? post.format}</span>
          )}
          <span style={{ fontFamily: f, fontSize: 10, color: '#9ca3af', marginLeft: 'auto' }}>
            {new Date(date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{ textAlign: 'right', minWidth: 60 }}>
          <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 16, color: '#111827', margin: 0, lineHeight: 1 }}>{fmtNum(m?.reach ?? 0)}</p>
          <p style={{ fontFamily: f, fontSize: 9, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '3px 0 0' }}>Alcance</p>
        </div>
        <div style={{ textAlign: 'right', minWidth: 50 }}>
          <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 16, color: '#111827', margin: 0, lineHeight: 1 }}>{fmtNum(m?.likes ?? 0)}</p>
          <p style={{ fontFamily: f, fontSize: 9, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '3px 0 0' }}>Likes</p>
        </div>
        <div style={{ textAlign: 'right', minWidth: 56 }}>
          <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 16, color: ACCENT, margin: 0, lineHeight: 1 }}>{m?.engagement_rate != null ? `${m.engagement_rate.toFixed(1)}%` : '—'}</p>
          <p style={{ fontFamily: f, fontSize: 9, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '3px 0 0' }}>Eng.</p>
        </div>
      </div>
      <ExternalLink size={14} style={{ color: '#d1d5db' }} />
    </Link>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function FeedPage() {
  const searchParams = useSearchParams();
  const initialTab  = (searchParams.get('platform') as Platform | null) ?? 'instagram';
  const initialMode = searchParams.get('tab') === 'historial' ? 'historial' : 'pipeline';

  const [mode, setMode] = useState<PageMode>(initialMode as PageMode);

  // KPIs (shared across both tabs)
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  // Pipeline state
  const [tab, setTab] = useState<Platform>(
    (['instagram', 'facebook', 'tiktok'] as const).includes(initialTab as Platform) ? initialTab as Platform : 'instagram',
  );
  const [cache, setCache] = useState<Partial<Record<Platform, FeedData>>>({});
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError]     = useState<string | null>(null);
  const [onlyUpcoming, setOnlyUpcoming] = useState(false);

  // Historial state
  const [allPosts,     setAllPosts]     = useState<Post[]>([]);
  const [topPosts,     setTopPosts]     = useState<Post[]>([]);
  const [histStats,    setHistStats]    = useState<{ totalReach: number; totalLikes: number; avgEngagementRate: number; published: number } | null>(null);
  const [histLoading,  setHistLoading]  = useState(false);
  const [histPlatform, setHistPlatform] = useState<'all' | Platform>('all');
  const [search,       setSearch]       = useState('');
  const [view,         setView]         = useState<ViewMode>('grid');

  // Load KPIs on mount (auto-refresh on session start)
  useEffect(() => {
    fetch('/api/dashboard/metrics')
      .then(r => r.ok ? r.json() : null)
      .then((d: DashboardMetrics | null) => { if (d) setMetrics(d); })
      .catch(() => { /* silent */ });
  }, []);

  // Pipeline loading
  const loadTab = useCallback(async (p: Platform, force = false) => {
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
  }, [cache]);

  useEffect(() => {
    if (mode === 'pipeline') loadTab(tab);
  }, [tab, mode, loadTab]);

  // Historial loading
  const loadHistorial = useCallback((p: 'all' | Platform) => {
    setHistLoading(true);
    const params = new URLSearchParams({ status: 'published', range: 'all' });
    if (p !== 'all') params.set('platform', p);
    fetch(`/api/historial?${params}`)
      .then(r => r.json())
      .then(d => {
        setAllPosts((d.posts ?? []) as Post[]);
        setTopPosts((d.topPerformers ?? []) as Post[]);
        setHistStats(d.stats ?? null);
      })
      .catch(() => { /* silent */ })
      .finally(() => setHistLoading(false));
  }, []);

  useEffect(() => {
    if (mode === 'historial') loadHistorial(histPlatform);
  }, [mode, histPlatform, loadHistorial]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allPosts;
    return allPosts.filter(p =>
      p.caption?.toLowerCase().includes(q) ||
      (Array.isArray(p.hashtags) && p.hashtags.some(h => h.toLowerCase().includes(q)))
    );
  }, [allPosts, search]);

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

  // Merge published + scheduled into chronological feed preview items
  const feedItems: GridItem[] = useMemo(() => {
    if (!feedData) return [];
    const pub: GridItem[] = feedData.published.map(p => ({
      kind: 'published' as const, id: p.id, imageUrl: p.imageUrl, caption: p.caption, permalink: p.permalink, timestamp: p.timestamp ?? new Date(0).toISOString(),
    }));
    const sch: GridItem[] = feedData.queued.map(q => ({
      kind: 'scheduled' as const, id: q.id, postId: q.postId, imageUrl: q.imageUrl, caption: q.caption, scheduledAt: q.scheduledAt, status: q.status,
    }));
    // Scheduled first (chronological), then published (reverse-chronological)
    sch.sort((a, b) => {
      const ta = a.kind === 'scheduled' && a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const tb = b.kind === 'scheduled' && b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      return ta - tb;
    });
    return [...sch, ...pub];
  }, [feedData]);

  // ── KPIs (En directo) ──
  const pipelineKpis = useMemo(() => {
    const scheduled = metrics?.counts.scheduled ?? 0;
    const pending   = metrics?.counts.pending   ?? 0;
    const reach     = metrics?.thisWeek.reach   ?? 0;
    const eng       = metrics?.thisWeek.engagementRate ?? 0;
    const next      = feedData?.queued.find(q => q.scheduledAt) ?? null;
    return [
      { label: 'Programadas', value: String(scheduled + pending), meta: `${pending} pendientes` },
      { label: 'Alcance · 7 días', value: fmtNum(reach), delta: fmtDelta(metrics?.changes.reach ?? null) },
      { label: 'Engagement', value: eng ? `${eng.toFixed(1)}%` : '—', delta: fmtDelta(metrics?.changes.engagement ?? null) },
      { label: 'Próxima publicación', value: next?.scheduledAt ? fmtScheduledDate(next.scheduledAt) : '—', meta: next ? PLATFORMS_META[tab].label : 'Sin programar' },
    ];
  }, [metrics, feedData, tab]);

  const histKpis = useMemo(() => [
    { label: 'Publicados', value: String(histStats?.published ?? 0), meta: 'Total histórico' },
    { label: 'Alcance total', value: fmtNum(histStats?.totalReach ?? 0) },
    { label: 'Likes totales', value: fmtNum(histStats?.totalLikes ?? 0) },
    { label: 'Engagement medio', value: histStats?.avgEngagementRate ? `${histStats.avgEngagementRate.toFixed(1)}%` : '—' },
  ], [histStats]);

  return (
    <div className="page-content dashboard-unified-page" style={{ maxWidth: 1060 }}>

      {/* ── Header (gray zone) ── */}
      <div className="dashboard-unified-header" style={{ padding: '48px 0 32px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <p style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: ACCENT, margin: '0 0 6px' }}>
            Tus publicaciones
          </p>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: '#111827', lineHeight: 0.95, margin: 0 }}>
            Feed
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {mode === 'historial' && allPosts.length > 0 && (
            <button onClick={exportCSV} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontFamily: fc, fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              <Download size={12} /> Exportar CSV
            </button>
          )}
          <button
            type="button"
            onClick={() => { if (mode === 'pipeline') loadTab(tab, true); else loadHistorial(histPlatform); }}
            disabled={feedLoading || histLoading}
            title="Sincronizar ahora"
            style={{ padding: '10px 14px', background: '#fff', border: '1px solid #e5e7eb', fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: (feedLoading || histLoading) ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, color: '#6b7280' }}
          >
            <RefreshCw size={12} className={(feedLoading || histLoading) ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Main tabs ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginTop: 20, marginBottom: 28 }}>
        {([['pipeline', 'En directo'], ['historial', 'Historial']] as [PageMode, string][]).map(([m, label]) => (
          <button key={m} type="button" onClick={() => setMode(m)} style={{
            padding: '11px 20px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontFamily: f, fontSize: 14, fontWeight: mode === m ? 700 : 400,
            color: mode === m ? '#111827' : '#6b7280',
            borderBottom: mode === m ? '2px solid #111827' : '2px solid transparent',
            marginBottom: -1, transition: 'color 0.14s',
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* ══════════ EN DIRECTO ══════════ */}
      {mode === 'pipeline' && (
        <>
          <KpiStrip items={pipelineKpis} />

          {/* Platform pills */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['instagram', 'facebook', 'tiktok'] as const).map(p => {
                const pData     = cache[p];
                const active    = tab === p;
                const connected = pData?.connected ?? null;
                return (
                  <button key={p} onClick={() => setTab(p)} style={{
                    padding: '7px 14px',
                    background: active ? '#111827' : '#fff',
                    color: active ? '#fff' : '#6b7280',
                    border: `1px solid ${active ? '#111827' : '#e5e7eb'}`,
                    fontFamily: f, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                  }}>
                    <PlatformIcon platform={p} size={12} color={active ? '#fff' : '#6b7280'} />
                    {PLATFORMS_META[p].label}
                    {connected !== null && (
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? ACCENT_2 : '#d1d5db' }} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Toggle: ver solo próximos */}
            <div style={{ display: 'flex', gap: 0, border: '1px solid #e5e7eb', background: '#fff' }}>
              <button type="button" onClick={() => setOnlyUpcoming(false)} style={{
                padding: '6px 14px', border: 'none', background: !onlyUpcoming ? '#111827' : 'transparent',
                color: !onlyUpcoming ? '#fff' : '#6b7280', fontFamily: f, fontSize: 11, fontWeight: 600,
                cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>Feed completo</button>
              <button type="button" onClick={() => setOnlyUpcoming(true)} style={{
                padding: '6px 14px', border: 'none', borderLeft: '1px solid #e5e7eb',
                background: onlyUpcoming ? '#111827' : 'transparent',
                color: onlyUpcoming ? '#fff' : '#6b7280', fontFamily: f, fontSize: 11, fontWeight: 600,
                cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>Solo próximos</button>
            </div>
          </div>

          {/* Connection banner */}
          {feedData && !feedData.connected && (
            <div style={{ padding: '14px 18px', border: '1px solid #e5e7eb', background: '#fff', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#111827', margin: 0 }}>
                  {PLATFORMS_META[tab].label} no conectado
                </p>
                <p style={{ fontFamily: f, fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>
                  Conéctalo para ver el feed real junto con las publicaciones programadas.
                </p>
              </div>
              <Link href={PLATFORMS_META[tab].connectHref} style={{ padding: '8px 16px', background: ACCENT, color: '#fff', textDecoration: 'none', fontFamily: fc, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
                Conectar
              </Link>
            </div>
          )}

          {feedError && (
            <div style={{ padding: 16, border: '1px solid #fca5a5', background: '#fef2f2', fontFamily: f, fontSize: 13, color: '#991b1b', marginBottom: 16 }}>{feedError}</div>
          )}

          {feedLoading && !feedData ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} style={{ aspectRatio: '1', background: '#f3f4f6', opacity: 1 - i * 0.06 }} className="hist-skeleton" />
              ))}
            </div>
          ) : (
            <FeedPreviewGrid items={feedItems} onlyUpcoming={onlyUpcoming} />
          )}

          {feedData && feedData.queued.length > 0 && <WeekTimeline scheduled={feedData.queued} />}
        </>
      )}

      {/* ══════════ HISTORIAL ══════════ */}
      {mode === 'historial' && (
        <>
          <KpiStrip items={histKpis} />

          {/* Filter row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {([{ id: 'all' as const, label: 'Todas' }, ...ALL_PLATFORMS]).map(({ id, label }) => {
                const active = histPlatform === id;
                return (
                  <button key={id} type="button" onClick={() => setHistPlatform(id)} style={{
                    padding: '7px 14px',
                    background: active ? '#111827' : '#fff',
                    color: active ? '#fff' : '#6b7280',
                    border: `1px solid ${active ? '#111827' : '#e5e7eb'}`,
                    fontFamily: f, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                  }}>
                    {id !== 'all' && <PlatformIcon platform={id} size={12} color={active ? '#fff' : '#6b7280'} />}
                    {label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ position: 'relative', minWidth: 180 }}>
                <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
                <input type="text" placeholder="Buscar…" value={search} onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '7px 28px 7px 28px', border: '1px solid #e5e7eb', background: '#fff', fontFamily: f, fontSize: 12, color: '#111827', outline: 'none', boxSizing: 'border-box' }} />
                {search && (
                  <button type="button" onClick={() => setSearch('')} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 2, display: 'flex' }}>
                    <X size={12} />
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', border: '1px solid #e5e7eb', background: '#fff' }}>
                {([['grid', LayoutGrid], ['list', List]] as [ViewMode, typeof LayoutGrid][]).map(([v, Icon], i) => (
                  <button key={v} type="button" onClick={() => setView(v)} style={{
                    padding: '7px 10px', border: 'none', borderLeft: i > 0 ? '1px solid #e5e7eb' : 'none', cursor: 'pointer',
                    background: view === v ? '#111827' : 'transparent',
                    color: view === v ? '#fff' : '#9ca3af',
                    display: 'flex', alignItems: 'center',
                  }}>
                    <Icon size={14} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Top performers */}
          {topPosts.length > 0 && (
            <section style={{ marginBottom: 36 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
                <TrendingUp size={14} style={{ color: ACCENT }} />
                <h2 style={{ fontFamily: fc, fontSize: 14, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#111827', margin: 0 }}>Top rendimiento</h2>
                <p style={{ fontFamily: f, fontSize: 11, color: '#9ca3af', margin: 0 }}>· tus 3 mejores publicaciones</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {topPosts.map((p, i) => <TopCard key={p.id} post={p} rank={i + 1} />)}
              </div>
            </section>
          )}

          {/* All posts */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
            <h2 style={{ fontFamily: fc, fontSize: 14, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#111827', margin: 0 }}>Todo lo publicado</h2>
            <p style={{ fontFamily: f, fontSize: 11, color: '#9ca3af', margin: 0 }}>· {filtered.length} {filtered.length === 1 ? 'publicación' : 'publicaciones'}</p>
          </div>

          {histLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} style={{ aspectRatio: '1', background: '#f3f4f6', opacity: 1 - i * 0.07 }} className="hist-skeleton" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ border: '1px solid #e5e7eb', background: '#fff', padding: '80px 20px', textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, background: '#f9fafb', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Search size={20} style={{ color: '#9ca3af' }} />
              </div>
              <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 20, textTransform: 'uppercase', color: '#111827', letterSpacing: '0.02em', marginBottom: 8 }}>
                {allPosts.length === 0 ? 'Historial vacío' : 'Sin resultados'}
              </p>
              <p style={{ fontFamily: f, fontSize: 13, color: '#9ca3af', maxWidth: 340, margin: '0 auto 28px' }}>
                {allPosts.length === 0
                  ? 'Aquí aparecerán todas las publicaciones que realices en tus redes sociales.'
                  : 'No hay publicaciones que coincidan con los filtros actuales.'}
              </p>
            </div>
          ) : view === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }} className="hist-grid">
              {filtered.map(p => <HistorialGridCard key={p.id} post={p} />)}
            </div>
          ) : (
            <div style={{ border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              {filtered.map((p, i) => <HistorialListRow key={p.id} post={p} isLast={i === filtered.length - 1} />)}
            </div>
          )}
        </>
      )}

      <style>{`
        .hist-grid-img { image-orientation: from-image; transition: transform 0.4s ease; }
        .hist-grid-card:hover .hist-grid-img { transform: scale(1.04); }
        .hist-list-row:hover { background: #f9fafb !important; }
        .spin { animation: spin 0.9s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes hist-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .hist-skeleton { animation: hist-pulse 1.6s ease-in-out infinite; }
        @media (max-width: 640px) {
          .hist-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
