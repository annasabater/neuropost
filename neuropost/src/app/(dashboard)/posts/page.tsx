'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Grid3x3, LayoutList, GripVertical, Pencil, ArrowRight, Calendar, Eye, CheckCircle2, Clock, Zap, ImageIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import toast from 'react-hot-toast';
import type { Post, PostStatus } from '@/types';
import { useAppStore } from '@/store/useAppStore';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

type QueuedFeedItem  = { id: string; queueId: string | null; postId: string; imageUrl: string | null; caption: string | null; status: string; scheduledAt: string | null; position: number; };
type PublishedFeedItem = { id: string; imageUrl: string | null; caption: string | null; permalink: string | null; timestamp: string | null; };

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_DISPLAY: Record<string, string> = {
  request: 'En preparación', draft: 'En preparación',
  generated: 'Para revisar',  pending: 'Para revisar', approved: 'Para revisar',
  scheduled: 'Programado',    published: 'Publicado',
  failed: 'Fallido',          cancelled: 'Cancelado',
};

const STATUS_STYLE: Record<string, { dot: string; text: string; bg: string }> = {
  request:   { dot: '#0D9488', text: '#0D9488', bg: '#f0fdfa' },
  draft:     { dot: '#0D9488', text: '#0D9488', bg: '#f0fdfa' },
  generated: { dot: '#F59E0B', text: '#92400E', bg: '#fffbeb' },
  pending:   { dot: '#F59E0B', text: '#92400E', bg: '#fffbeb' },
  approved:  { dot: '#F59E0B', text: '#92400E', bg: '#fffbeb' },
  scheduled: { dot: '#3B82F6', text: '#1e40af', bg: '#eff6ff' },
  published: { dot: '#10B981', text: '#065f46', bg: '#ecfdf5' },
  failed:    { dot: '#EF4444', text: '#991b1b', bg: '#fef2f2' },
  cancelled: { dot: '#9CA3AF', text: '#6b7280', bg: '#f9fafb' },
};

// ── Feed cell components ───────────────────────────────────────────────────────
function SortableQueuedFeedCell({ item, index }: { item: QueuedFeedItem; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, aspectRatio: '1', position: 'relative', overflow: 'hidden', cursor: 'grab', background: '#f3f4f6' }}>
      {item.imageUrl
        ? <img src={item.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', imageOrientation: 'from-image' }} />
        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}><Plus size={18} /></div>}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: fc, fontSize: 24, fontWeight: 900, color: '#fff' }}>{index + 1}</span>
      </div>
      <div style={{ position: 'absolute', top: 5, left: 5, background: 'var(--accent)', color: '#fff', fontSize: 8, fontWeight: 700, padding: '2px 5px', fontFamily: f }}>COLA</div>
    </div>
  );
}

function PublishedFeedCell({ item }: { item: PublishedFeedItem }) {
  return (
    <div style={{ aspectRatio: '1', position: 'relative', overflow: 'hidden', background: '#f3f4f6' }}>
      {item.imageUrl
        ? <img src={item.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', imageOrientation: 'from-image' }} />
        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}><Plus size={18} /></div>}
      {item.permalink && <a href={item.permalink} target="_blank" rel="noopener noreferrer" style={{ position: 'absolute', inset: 0 }} aria-label="Ver en Instagram" />}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PostsPage() {
  const t            = useTranslations('posts');
  const brand        = useAppStore((s) => s.brand);
  const setPosts     = useAppStore((s) => s.setPosts);
  const storePostList = useAppStore((s) => s.posts);
  const searchParams = useSearchParams();

  const [posts, setPosts_]           = useState<Post[]>([]);
  const [visibleCount, setVisibleCount] = useState(12);
  const initialFilter = (searchParams.get('filter') ?? 'all') as PostStatus | 'all' | 'proposal';
  const [filter, setFilter]          = useState<PostStatus | 'all' | 'proposal'>(initialFilter);
  const [loading, setLoading]        = useState(true);
  const [view, setView]              = useState<'grid' | 'feed'>('grid');
  const [queuedItems, setQueuedItems]   = useState<QueuedFeedItem[]>([]);
  const [publishedItems, setPublishedItems] = useState<PublishedFeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [saving, setSaving]          = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const STATUS_LABEL: Record<string, string> = {
    request: 'En preparación', draft: 'En preparación', generated: 'Para revisar',
    pending: 'Para revisar',   approved: 'Para revisar', scheduled: t('status.scheduled'),
    published: t('status.published'), failed: t('status.failed'), cancelled: t('status.cancelled'),
    proposal: 'Propuesta automática', all: t('status.all'),
  };

  function isWorkerProposal(p: Post): boolean {
    if (!p.ai_explanation) return false;
    try { return JSON.parse(p.ai_explanation)?.from_worker === true; } catch { return false; }
  }
  const proposalPosts = posts.filter(p => isWorkerProposal(p) && ['generated','pending','draft'].includes(p.status));

  useEffect(() => {
    fetch('/api/posts?limit=100')
      .then(r => r.json())
      .then(json => { const list = json.posts ?? []; setPosts_(list); setPosts(list); })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (storePostList.length) setPosts_(storePostList); }, [storePostList]);

  const fetchFeed = useCallback(() => {
    setFeedLoading(true);
    fetch('/api/meta/feed-preview')
      .then(r => r.json())
      .then(d => { setQueuedItems(d.queued ?? []); setPublishedItems(d.published ?? []); })
      .finally(() => setFeedLoading(false));
  }, []);

  useEffect(() => { if (view === 'feed') fetchFeed(); }, [view, fetchFeed]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setQueuedItems(prev => {
      const oi = prev.findIndex(i => i.id === active.id);
      const ni = prev.findIndex(i => i.id === over.id);
      return arrayMove(prev, oi, ni).map((item, idx) => ({ ...item, position: idx }));
    });
  }

  async function saveFeedOrder() {
    setSaving(true);
    const res = await fetch('/api/worker/feed-queue', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: queuedItems.map((item, idx) => ({ id: item.id, queueId: item.queueId, postId: item.postId, imageUrl: item.imageUrl, position: idx, scheduledAt: item.scheduledAt })) }),
    });
    if (res.ok) toast.success('Orden guardado'); else toast.error('Error al guardar');
    setSaving(false);
  }

  const filtered = filter === 'all' ? posts
    : filter === 'proposal' ? proposalPosts
    : filter === 'pending'  ? posts.filter(p => ['pending','draft'].includes(p.status))
    : posts.filter(p => p.status === filter);
  const visiblePosts = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;
  const gridQueued    = queuedItems.slice(0, 9);
  const gridPublished = publishedItems.slice(0, Math.max(0, 9 - gridQueued.length));

  // Stats
  const countPreparation = posts.filter(p => ['request','draft'].includes(p.status)).length;
  const countReview      = posts.filter(p => ['pending','generated','approved'].includes(p.status)).length;
  const countScheduled   = posts.filter(p => p.status === 'scheduled').length;
  const countPublished   = posts.filter(p => p.status === 'published').length;

  const STATS = [
    { count: countPreparation, label: 'En preparación', filterVal: 'request' as PostStatus | 'all' | 'proposal', icon: Clock,         color: '#0D9488', bg: '#f0fdfa' },
    { count: countReview,      label: 'Para revisar',    filterVal: 'pending' as PostStatus | 'all' | 'proposal', icon: Eye,           color: '#F59E0B', bg: '#fffbeb', urgent: countReview > 0 },
    { count: countScheduled,   label: 'Programados',     filterVal: 'scheduled' as PostStatus | 'all' | 'proposal', icon: Calendar,    color: '#3B82F6', bg: '#eff6ff' },
    { count: countPublished,   label: 'Publicados',      filterVal: 'published' as PostStatus | 'all' | 'proposal', icon: CheckCircle2, color: '#10B981', bg: '#ecfdf5' },
  ];

  const SEGMENT_FILTERS = [
    { value: 'request'  as PostStatus | 'all' | 'proposal', label: 'Preparación',  count: countPreparation },
    { value: 'pending'  as PostStatus | 'all' | 'proposal', label: 'Para revisar', count: countReview, urgent: countReview > 0 },
    { value: 'scheduled'as PostStatus | 'all' | 'proposal', label: 'Programados',  count: countScheduled },
    { value: 'published'as PostStatus | 'all' | 'proposal', label: 'Publicados',   count: countPublished },
  ];

  return (
    <div className="page-content dashboard-unified-page" style={{ maxWidth: 1060 }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="dashboard-unified-header posts-page-header" style={{ padding: '32px 0 20px' }}>

        {/* Title row */}
        <div className="posts-title-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2rem, 5vw, 3.2rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: 'var(--text-primary)', lineHeight: 0.95 }}>
            Contenido
          </h1>
          <Link href="/posts/new" className="posts-cta-btn" style={{
            background: 'var(--accent)', color: '#fff', textDecoration: 'none',
            padding: '10px 20px', fontFamily: fc, fontSize: 12, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.07em',
            display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
            boxShadow: '0 2px 8px rgba(13,148,136,0.25)',
          }}>
            <Plus size={14} />
            <span className="posts-cta-text">Solicitar contenido</span>
          </Link>
        </div>

        {/* Stats cards */}
        <div className="posts-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
          {STATS.map(({ count, label, filterVal, icon: Icon, color, bg, urgent }) => {
            const isActive = filter === filterVal;
            return (
              <button
                key={label}
                type="button"
                onClick={() => { setFilter(isActive ? 'all' : filterVal); setVisibleCount(12); }}
                aria-label={`${count} ${label}`}
                style={{
                  padding: '10px 12px',
                  border: `1.5px solid ${isActive ? color : 'var(--border)'}`,
                  background: isActive ? bg : '#fff',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s', position: 'relative',
                  boxShadow: isActive ? `0 2px 8px ${color}22` : '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                {urgent && !isActive && (
                  <span style={{ position: 'absolute', top: 10, right: 10, width: 7, height: 7, borderRadius: '50%', background: '#EF4444' }} />
                )}
                <Icon size={13} style={{ color: isActive ? color : '#9ca3af', marginBottom: 5, display: 'block' }} />
                <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 20, color: isActive ? color : 'var(--text-primary)', lineHeight: 1, marginBottom: 2 }}>{count}</p>
                <p style={{ fontFamily: f, fontSize: 10, color: isActive ? color : 'var(--text-tertiary)', margin: 0 }}>{label}</p>
              </button>
            );
          })}
        </div>

        {/* Collapsible process info */}
        <details className="process-help" style={{ marginBottom: 4 }}>
          <summary style={{ fontFamily: f, fontSize: 12, color: 'var(--text-tertiary)', cursor: 'pointer', listStyle: 'none', userSelect: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 0' }}>
            <span style={{ fontSize: 13 }}>ⓘ</span> Cómo funciona el proceso
          </summary>
          <div style={{ background: 'var(--bg-1)', padding: '12px 16px', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5, border: '1px solid var(--border)' }}>
            {[
              ['Preparación', 'El equipo de NeuroPost edita y optimiza tu contenido.'],
              ['Para revisar', 'Tú apruebas o devuelves la propuesta.'],
              ['Programado', 'Con fecha fijada, se publica automáticamente.'],
              ['Publicado', 'Ya visible en tus redes.'],
            ].map(([title, desc]) => (
              <p key={title} style={{ fontFamily: f, fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                <strong>{title}</strong> — {desc}
              </p>
            ))}
          </div>
        </details>
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <div className="posts-filter-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 24, marginTop: 16, flexWrap: 'wrap' }}>

        {view === 'grid' && (
          <div style={{ display: 'flex', gap: 1, overflowX: 'auto', flexShrink: 1 }}>
            {/* All */}
            {[
              { value: 'all' as PostStatus | 'all' | 'proposal', label: 'Todos', count: posts.length },
              ...(proposalPosts.length > 0 ? [{ value: 'proposal' as PostStatus | 'all' | 'proposal', label: 'Propuestas', count: proposalPosts.length }] : []),
              ...SEGMENT_FILTERS,
            ].map((sf) => {
              const active = filter === sf.value;
              const isUrgent = 'urgent' in sf && sf.urgent;
              return (
                <button
                  key={sf.value}
                  type="button"
                  onClick={() => { setFilter(sf.value); setVisibleCount(12); }}
                  style={{
                    padding: '7px 14px',
                    background: active ? '#111827' : 'transparent',
                    border: `1px solid ${active ? '#111827' : 'var(--border)'}`,
                    color: active ? '#fff' : 'var(--text-secondary)',
                    fontFamily: f, fontSize: 12, fontWeight: active ? 600 : 400,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                    whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.12s',
                  }}
                >
                  {sf.label}
                  {sf.count > 0 && (
                    <span style={{
                      background: isUrgent && !active ? '#EF4444' : active ? 'rgba(255,255,255,0.2)' : 'var(--bg-2)',
                      color: isUrgent && !active ? '#fff' : active ? '#fff' : 'var(--text-tertiary)',
                      fontSize: 10, fontWeight: 700, padding: '0 5px', borderRadius: 99, lineHeight: '18px', minWidth: 18, textAlign: 'center',
                    }}>
                      {sf.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {view === 'feed' && (
          <span style={{ fontFamily: f, fontSize: 13, color: 'var(--text-tertiary)' }}>
            Tus próximos posts y tu feed real de Instagram
          </span>
        )}

        {/* View toggle */}
        <div style={{ display: 'flex', border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
          {([
            { v: 'grid' as const, icon: <LayoutList size={13} />, label: 'Posts' },
            { v: 'feed' as const, icon: <Grid3x3 size={13} />,   label: 'Feed' },
          ] as const).map(({ v, icon, label }) => (
            <button key={v} type="button" onClick={() => setView(v)} style={{
              padding: '7px 16px', background: view === v ? '#111827' : 'transparent',
              color: view === v ? '#fff' : 'var(--text-tertiary)',
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.04em', transition: 'all 0.12s',
            }}>
              {icon} {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── GRID VIEW ─────────────────────────────────────────────────────────── */}
      {view === 'grid' && (
        <>
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ background: 'var(--bg-1)', borderRadius: 2 }}>
                  <div style={{ aspectRatio: '1', background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ height: 10, background: '#e5e7eb', width: '60%', marginBottom: 6 }} />
                    <div style={{ height: 8, background: '#f3f4f6', width: '40%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', border: '1px dashed var(--border)', background: '#fafafa' }}>
              <div style={{ width: 48, height: 48, background: 'var(--bg-1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <ImageIcon size={20} style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 20, textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 8 }}>
                {filter === 'all' ? 'Empieza a crear contenido' : `Sin posts en "${STATUS_LABEL[filter]}"`}
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: f, marginBottom: 24, maxWidth: 360, margin: '0 auto 24px' }}>
                {filter === 'all' ? 'Solicita tu primera publicación y empieza a hacer crecer tu negocio.' : 'Prueba con otro filtro o solicita contenido nuevo.'}
              </p>
              {filter !== 'proposal' && (
                <Link href="/posts/new" style={{ background: 'var(--accent)', color: '#fff', padding: '11px 28px', textDecoration: 'none', fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Plus size={13} /> Solicitar contenido
                </Link>
              )}
            </div>
          ) : (
            <div className="posts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {visiblePosts.map((post) => {
                const st = STATUS_STYLE[post.status] ?? STATUS_STYLE.cancelled;
                const label = STATUS_DISPLAY[post.status] ?? post.status;
                return (
                  <Link
                    key={post.id}
                    href={`/posts/${post.id}`}
                    className="post-card-v2"
                    style={{
                      background: '#fff', textDecoration: 'none', color: 'inherit',
                      display: 'block',
                      border: '1px solid #e5e7eb', overflow: 'hidden',
                      transition: 'transform 0.18s, box-shadow 0.18s',
                    }}
                  >
                    {/* Image */}
                    <div style={{ aspectRatio: '1', background: '#f3f4f6', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                      {post.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={post.image_url} alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.3s', imageOrientation: 'from-image' }}
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                          <ImageIcon size={28} style={{ color: '#d1d5db' }} />
                          <span style={{ fontFamily: f, fontSize: 10, color: '#d1d5db' }}>Sin imagen</span>
                        </div>
                      )}
                      {/* Status dot */}
                      <div style={{ position: 'absolute', top: 8, left: 8 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(4px)',
                          padding: '3px 8px', fontSize: 9, fontFamily: f, fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                          color: st.text, border: `1px solid ${st.dot}22`,
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
                          {label}
                        </span>
                      </div>
                      {/* Hover overlay */}
                      <div className="post-card-actions" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.38)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.18s' }}>
                        <div style={{ background: '#fff', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6, fontFamily: fc, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#111' }}>
                          <Eye size={13} /> Ver
                        </div>
                      </div>
                    </div>

                  </Link>
                );
              })}
            </div>
          )}

          {hasMore && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 28 }}>
              <button type="button" onClick={() => setVisibleCount(v => v + 12)} style={{ background: 'transparent', border: '1.5px solid var(--border)', color: 'var(--text-secondary)', padding: '10px 32px', fontFamily: f, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Zap size={13} style={{ color: 'var(--accent)' }} />
                Ver {Math.min(12, filtered.length - visibleCount)} más · {filtered.length - visibleCount} restantes
              </button>
            </div>
          )}
        </>
      )}

      {/* ── FEED VIEW ─────────────────────────────────────────────────────────── */}
      {view === 'feed' && (
        <div className="posts-feed-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignItems: 'start' }}>
          {/* Queue list */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 8, borderBottom: '2px solid #111827' }}>
              <h2 style={{ fontFamily: fc, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#111827', margin: 0 }}>
                Cola de publicación
              </h2>
              <button onClick={saveFeedOrder} disabled={saving} style={{ background: '#111827', color: '#fff', border: 'none', padding: '6px 14px', cursor: 'pointer', fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: saving ? 0.5 : 1 }}>
                {saving ? 'Guardando...' : 'Guardar orden'}
              </button>
            </div>
            {feedLoading ? (
              <p style={{ color: 'var(--text-tertiary)', fontSize: 13, fontFamily: f }}>Cargando...</p>
            ) : queuedItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 0', border: '1.5px dashed var(--border)' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, fontFamily: f, marginBottom: 10 }}>No hay posts en cola</p>
                <Link href="/posts/new" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: f, fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                  <Plus size={12} /> Solicitar contenido
                </Link>
              </div>
            ) : (
              <div style={{ border: '1px solid var(--border)' }}>
                {queuedItems.map((item, i) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: i < queuedItems.length - 1 ? '1px solid #f3f4f6' : 'none', transition: 'background 0.12s' }}>
                    <GripVertical size={13} style={{ color: '#d1d5db', cursor: 'grab', flexShrink: 0 }} />
                    <div style={{ width: 38, height: 38, overflow: 'hidden', background: 'var(--bg-1)', flexShrink: 0 }}>
                      {item.imageUrl && <img src={item.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', imageOrientation: 'from-image' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: f, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
                        {item.caption?.slice(0, 50) ?? 'Sin caption'}
                      </p>
                      <p style={{ fontFamily: f, fontSize: 10, color: 'var(--text-tertiary)' }}>
                        {item.scheduledAt ? `${new Date(item.scheduledAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : 'Sin fecha'}
                      </p>
                    </div>
                    <Link href={`/posts/${item.postId}`} style={{ color: 'var(--accent)', padding: 4 }}><Pencil size={12} /></Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* IG grid preview */}
          <div>
            <div style={{ marginBottom: 14, paddingBottom: 8, borderBottom: '2px solid #111827' }}>
              <h2 style={{ fontFamily: fc, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#111827', margin: 0 }}>
                Preview Instagram
              </h2>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={gridQueued.map(i => i.id)} strategy={rectSortingStrategy}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
                  {gridQueued.map((item, i) => <SortableQueuedFeedCell key={item.id} item={item} index={i} />)}
                  {gridPublished.map(item => <PublishedFeedCell key={item.id} item={item} />)}
                  {Array.from({ length: Math.max(0, 9 - gridQueued.length - gridPublished.length) }).map((_, i) => (
                    <div key={`e-${i}`} style={{ aspectRatio: '1', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>
                      <Plus size={16} />
                    </div>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <p style={{ marginTop: 10, color: 'var(--text-tertiary)', fontSize: 11, fontFamily: f }}>Cola arriba · feed real debajo</p>
            {brand?.ig_username && (
              <a href={`https://instagram.com/${brand.ig_username}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10, fontFamily: f, fontSize: 11, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Ver en Instagram <ArrowRight size={11} />
              </a>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
