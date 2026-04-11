'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Grid3x3, LayoutList, GripVertical, Pencil, ArrowRight, Calendar, Eye, Upload, Send } from 'lucide-react';
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

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

type QueuedFeedItem = {
  id: string;
  queueId: string | null;
  postId: string;
  imageUrl: string | null;
  caption: string | null;
  status: string;
  scheduledAt: string | null;
  position: number;
};

type PublishedFeedItem = {
  id: string;
  imageUrl: string | null;
  caption: string | null;
  permalink: string | null;
  timestamp: string | null;
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  request:   { bg: 'var(--accent)',    color: '#fff' },
  draft:     { bg: '#6B7280',          color: '#fff' },
  generated: { bg: '#3B82F6',          color: '#fff' },
  pending:   { bg: '#F59E0B',          color: '#fff' },
  approved:  { bg: '#10B981',          color: '#fff' },
  scheduled: { bg: '#3B82F6',          color: '#fff' },
  published: { bg: 'var(--accent)',    color: '#fff' },
  failed:    { bg: '#EF4444',          color: '#fff' },
  cancelled: { bg: '#9CA3AF',          color: '#fff' },
};

function SortableQueuedFeedCell({ item, index }: { item: QueuedFeedItem; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={{
      transform: CSS.Transform.toString(transform), transition,
      opacity: isDragging ? 0.4 : 1, aspectRatio: '1',
      position: 'relative', overflow: 'hidden', cursor: 'grab',
      background: 'var(--bg-1)',
    }}>
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 20 }}>+</div>
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.36)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: fc, fontSize: 28, fontWeight: 900, color: '#fff' }}>{index + 1}</span>
      </div>
      <div style={{ position: 'absolute', top: 6, left: 6, background: 'var(--accent)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 6px', fontFamily: f }}>
        En cola
      </div>
    </div>
  );
}

function PublishedFeedCell({ item }: { item: PublishedFeedItem }) {
  return (
    <div style={{ aspectRatio: '1', position: 'relative', overflow: 'hidden', background: 'var(--bg-1)' }}>
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 20 }}>+</div>
      )}
      <div style={{ position: 'absolute', top: 6, right: 6, background: 'var(--accent)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 6px', fontFamily: f }}>
        Publicado
      </div>
      {item.permalink && (
        <a href={item.permalink} target="_blank" rel="noopener noreferrer" style={{ position: 'absolute', inset: 0 }} aria-label="Ver en Instagram" />
      )}
    </div>
  );
}

export default function PostsPage() {
  const t = useTranslations('posts');
  const brand = useAppStore((s) => s.brand);
  const setPosts = useAppStore((s) => s.setPosts);
  const storePostList = useAppStore((s) => s.posts);
  const searchParams = useSearchParams();

  const [posts, setPosts_] = useState<Post[]>([]);
  // 'proposal' is a synthetic filter: posts the worker team proposed (marked
  // via ai_explanation.from_worker) and that are still awaiting client decision.
  const initialFilter = (searchParams.get('filter') ?? 'all') as PostStatus | 'all' | 'proposal';
  const [filter, setFilter] = useState<PostStatus | 'all' | 'proposal'>(initialFilter);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'feed'>('grid');

  const [queuedItems, setQueuedItems] = useState<QueuedFeedItem[]>([]);
  const [publishedItems, setPublishedItems] = useState<PublishedFeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const STATUS_LABEL: Record<string, string> = {
    request: t('status.request'), draft: t('status.draft'), generated: t('status.generated'),
    pending: t('status.pending'), approved: t('status.approved'), scheduled: t('status.scheduled'),
    published: t('status.published'), failed: t('status.failed'), cancelled: t('status.cancelled'),
    proposal: 'Propuesta automática', all: t('status.all'),
  };

  // A post is a "team proposal" if the worker route stamped its ai_explanation
  // with from_worker=true and the client hasn't acted on it yet.
  function isWorkerProposal(p: Post): boolean {
    if (!p.ai_explanation) return false;
    try {
      const parsed = JSON.parse(p.ai_explanation);
      return parsed?.from_worker === true;
    } catch { return false; }
  }
  const proposalPosts = posts.filter(p => isWorkerProposal(p) && (p.status === 'generated' || p.status === 'pending' || p.status === 'draft'));

  const STATUS_FILTERS: { value: PostStatus | 'all' | 'proposal'; label: string; count: number }[] = [
    { value: 'all',       label: t('status.all'),       count: posts.length },
    { value: 'proposal',  label: 'Propuesta automática', count: proposalPosts.length },
    { value: 'request',   label: t('status.request'),   count: posts.filter(p => p.status === 'request').length },
    { value: 'pending',   label: 'Para revisar',         count: posts.filter(p => p.status === 'pending' || p.status === 'draft').length },
    { value: 'scheduled', label: t('status.scheduled'), count: posts.filter(p => p.status === 'scheduled').length },
    { value: 'published', label: t('status.published'), count: posts.filter(p => p.status === 'published').length },
  ];

  useEffect(() => {
    fetch('/api/posts?limit=50')
      .then((r) => r.json())
      .then((json) => { const list = json.posts ?? []; setPosts_(list); setPosts(list); })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (storePostList.length) setPosts_(storePostList); }, [storePostList]);

  const fetchFeed = useCallback(() => {
    setFeedLoading(true);
    fetch('/api/meta/feed-preview').then((r) => r.json()).then((d) => {
      setQueuedItems(d.queued ?? []);
      setPublishedItems(d.published ?? []);
    }).finally(() => setFeedLoading(false));
  }, []);

  useEffect(() => { if (view === 'feed') fetchFeed(); }, [view, fetchFeed]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setQueuedItems((prev) => {
      const oldIdx = prev.findIndex((i) => i.id === active.id);
      const newIdx = prev.findIndex((i) => i.id === over.id);
      return arrayMove(prev, oldIdx, newIdx).map((item, idx) => ({ ...item, position: idx }));
    });
  }

  async function saveFeedOrder() {
    setSaving(true);
    const res = await fetch('/api/worker/feed-queue', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: queuedItems.map((item, idx) => ({
          id: item.id, queueId: item.queueId, postId: item.postId,
          imageUrl: item.imageUrl, position: idx, scheduledAt: item.scheduledAt,
        })),
      }),
    });
    if (res.ok) toast.success('Orden guardado');
    else toast.error('Error al guardar');
    setSaving(false);
  }

  const filtered = filter === 'all' ? posts
    : filter === 'proposal' ? proposalPosts
    : filter === 'pending' ? posts.filter((p) => p.status === 'pending' || p.status === 'draft')
    : posts.filter((p) => p.status === filter);
  const gridQueued = queuedItems.slice(0, 9);
  const gridPublished = publishedItems.slice(0, Math.max(0, 9 - gridQueued.length));

  // Stats
  const statsActive = posts.filter(p => !['published', 'cancelled', 'failed'].includes(p.status)).length;
  const statsScheduled = posts.filter(p => p.status === 'scheduled').length;
  const statsPending = posts.filter(p => ['pending', 'request'].includes(p.status)).length;

  return (
    <div className="page-content dashboard-unified-page" style={{ maxWidth: 1060 }}>
      {/* ── Header ── */}
      <div className="dashboard-unified-header" style={{ padding: '48px 0 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
          <div>
            <h1 style={{
              fontFamily: fc, fontWeight: 900,
              fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
              textTransform: 'uppercase', letterSpacing: '0.01em',
              color: 'var(--text-primary)', lineHeight: 0.95, marginBottom: 10,
            }}>
              Contenido
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15, fontFamily: f }}>
              Tu hub de publicaciones
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
          {[
            { icon: <LayoutList size={13} />, label: 'Activos', value: statsActive },
            { icon: <Calendar size={13} />, label: 'Programados', value: statsScheduled },
            { icon: <Eye size={13} />,      label: 'En revisión', value: statsPending },
          ].map(({ icon, label, value }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ color: 'var(--text-tertiary)', display: 'flex' }}>{icon}</div>
              <span style={{ fontFamily: fc, fontSize: 20, fontWeight: 900, color: 'var(--text-primary)' }}>{value}</span>
              <span style={{ fontFamily: f, fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* ── Workflow timeline ── */}
        <div style={{ padding: '20px 24px', border: '1px solid var(--border)', background: 'var(--bg)', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, position: 'relative' }}>
            {[
              { label: 'En preparación', desc: 'El equipo NeuroPost edita y optimiza tu contenido' },
              { label: 'Pendiente', desc: 'Revisa la propuesta y decide si aprobar o devolver' },
              { label: 'Programado', desc: 'Fecha y hora definidas, se publica automáticamente' },
              { label: 'Publicado', desc: 'Visible en tus redes sociales' },
            ].map((step, i, arr) => (
              <div key={step.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                {/* Connector line */}
                {i < arr.length - 1 && (
                  <div style={{
                    position: 'absolute', top: 11, left: '50%', width: '100%', height: 2,
                    background: 'var(--accent)', zIndex: 0,
                  }} />
                )}
                {/* Step number */}
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', zIndex: 1,
                  background: '#111827',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 8,
                }}>
                  <span style={{ fontFamily: f, fontSize: 11, fontWeight: 700, color: '#fff' }}>{i + 1}</span>
                </div>
                {/* Label */}
                <p style={{
                  fontFamily: f, fontSize: 11, fontWeight: 700, color: '#111827',
                  textAlign: 'center', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.03em',
                }}>
                  {step.label}
                </p>
                <p style={{
                  fontFamily: f, fontSize: 10, color: 'var(--text-tertiary)',
                  textAlign: 'center', lineHeight: 1.4, maxWidth: 150, margin: '0 auto',
                }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 14, justifyContent: 'center', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <span style={{ fontFamily: f, fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 700 }}>&#8634;</span> Puedes devolver cualquier post a un paso anterior en cualquier momento
            </span>
            <span style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />
            <span style={{ fontFamily: f, fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 700 }}>&#9889;</span> Desde Pendiente puedes programar fecha o publicar al instante
            </span>
          </div>
        </div>
      </div>

      {/* ── Filters + View toggle ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 28, paddingBottom: 0,
      }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {view === 'grid' && STATUS_FILTERS.map((sf) => {
            const active = filter === sf.value;
            return (
              <button
                key={sf.value}
                onClick={() => setFilter(sf.value)}
                style={{
                  padding: '7px 16px', cursor: 'pointer',
                  fontFamily: f, fontSize: 12, fontWeight: 600,
                  background: active ? 'var(--accent)' : 'var(--bg)',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  borderTop: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  borderBottom: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  borderLeft: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  borderRight: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 0, transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {sf.label}
                {sf.count > 0 && (
                  <span style={{
                    background: active ? 'rgba(255,255,255,0.25)' : 'var(--bg-1)',
                    color: active ? '#fff' : 'var(--text-tertiary)',
                    fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 0,
                    minWidth: 18, textAlign: 'center',
                  }}>
                    {sf.count}
                  </span>
                )}
              </button>
            );
          })}
          {view === 'feed' && (
            <span style={{ fontFamily: f, fontSize: 13, color: 'var(--text-tertiary)', padding: '7px 0' }}>
              Tus próximos posts aparecen primero y debajo tu feed real de Instagram
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 0, borderRadius: 0, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {[
            { v: 'grid' as const, icon: <LayoutList size={13} />, label: 'Posts' },
            { v: 'feed' as const, icon: <Grid3x3 size={13} />,   label: 'Feed' },
          ].map(({ v, icon, label }) => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '7px 16px',
              background: view === v ? 'var(--accent)' : 'var(--bg)',
              color: view === v ? '#fff' : 'var(--text-tertiary)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
              fontFamily: f, fontSize: 11, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.04em',
              transition: 'all 0.15s',
            }}>
              {icon} {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── GRID VIEW ── */}
      {view === 'grid' && (
        <>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <span className="loading-spinner" />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px 20px',
              border: '2px dashed var(--border)', background: 'var(--bg-1)',
            }}>
              <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 22, textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 8 }}>
                {filter === 'all' ? 'Empieza a crear contenido' : `No hay posts en "${STATUS_LABEL[filter]}"`}
              </p>
              {filter !== 'proposal' && (
                <>
                  <p style={{ fontSize: 14, color: 'var(--text-tertiary)', fontFamily: f, marginBottom: 28, maxWidth: 400, margin: '0 auto 28px' }}>
                    Crea tu primera publicación y empieza a hacer crecer tu negocio en redes sociales
                  </p>
                  <Link href="/posts/new" style={{
                    background: 'var(--accent)', color: '#fff',
                    padding: '12px 32px', textDecoration: 'none',
                    fontFamily: fc, fontSize: 13, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}>
                    <Plus size={14} /> Nuevo contenido
                  </Link>
                </>
              )}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 16,
            }}>
              {filtered.map((post) => {
                const sc = STATUS_COLORS[post.status] ?? STATUS_COLORS.draft;
                return (
                  <Link key={post.id} href={`/posts/${post.id}`} className="post-card-hover" style={{
                    background: 'var(--bg)', textDecoration: 'none', color: 'inherit',
                    display: 'block', position: 'relative', overflow: 'hidden',
                    border: '1px solid var(--border)',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}>
                    {/* Image with gradient overlay */}
                    <div style={{ aspectRatio: '1', background: '#111', overflow: 'hidden', position: 'relative' }}>
                      {post.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={post.image_url} alt="" style={{
                          width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                          transition: 'transform 0.3s',
                        }} />
                      ) : (
                        <div style={{
                          width: '100%', height: '100%',
                          background: 'var(--bg-1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Plus size={24} style={{ color: 'var(--text-tertiary)', opacity: 0.65 }} />
                        </div>
                      )}
                      {/* Hover overlay */}
                      <div className="post-card-actions" style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(15,118,110,0.5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                        opacity: 0, transition: 'opacity 0.2s',
                      }}>
                        <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Eye size={16} style={{ color: 'var(--accent)' }} />
                        </div>
                      </div>
                    </div>
                    {/* Footer: status + date */}
                    <div style={{
                      padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      borderTop: '1px solid var(--border)',
                    }}>
                      <span style={{
                        fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                        letterSpacing: '0.04em', padding: '2px 8px',
                        background: post.status === 'published' ? 'rgba(15,118,110,0.1)' :
                                    post.status === 'scheduled' ? 'rgba(15,118,110,0.06)' :
                                    post.status === 'pending' || post.status === 'draft' ? 'var(--bg-1)' :
                                    'var(--bg-1)',
                        color: post.status === 'published' ? 'var(--accent)' :
                               post.status === 'scheduled' ? '#374151' :
                               post.status === 'pending' || post.status === 'draft' ? '#6B7280' :
                               '#9CA3AF',
                      }}>
                        {STATUS_LABEL[post.status] ?? post.status}
                      </span>
                      {post.scheduled_at && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--info)' }}>
                          <Calendar size={10} />
                          <span style={{ fontFamily: f, fontSize: 10, fontWeight: 600 }}>
                            {new Date(post.scheduled_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* ── Quick actions section ── */}
          <div style={{
            marginTop: 40, padding: '32px 0',
            borderTop: '1px solid var(--border)',
          }}>
            <p style={{
              fontFamily: fc, fontWeight: 900, fontSize: 18, textTransform: 'uppercase',
              letterSpacing: '0.02em', color: 'var(--text-primary)', marginBottom: 20,
            }}>
              Crear contenido
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { href: '/posts/new', icon: <Send size={18} />, title: 'Solicitar a NeuroPost', desc: 'Nuestro equipo crea tu contenido' },
                { href: '/ideas',     icon: <Pencil size={18} />, title: 'Generar desde idea', desc: 'Genera propuestas para ti' },
                { href: '/biblioteca', icon: <Upload size={18} />, title: 'Subir contenido', desc: 'Desde tu biblioteca de medios' },
              ].map(({ href, icon, title, desc }) => (
                <Link key={href} href={href} style={{
                  padding: '20px 24px', textDecoration: 'none',
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                  transition: 'border-color 0.15s, background 0.15s',
                }}>
                  <div style={{
                    width: 40, height: 40, background: 'var(--accent-soft)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, color: 'var(--accent)',
                  }}>
                    {icon}
                  </div>
                  <div>
                    <p style={{ fontFamily: fc, fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 4 }}>
                      {title}
                    </p>
                    <p style={{ fontFamily: f, fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                      {desc}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── FEED VIEW ── */}
      {view === 'feed' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>
          {/* Left: queue list */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)', margin: 0 }}>
                Cola de publicación
              </h2>
              <button onClick={saveFeedOrder} disabled={saving} style={{
                background: 'var(--accent)', color: '#fff',
                border: 'none', padding: '6px 16px', cursor: 'pointer',
                fontFamily: f, fontSize: 11, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.06em',
                opacity: saving ? 0.5 : 1, borderRadius: 0,
              }}>
                {saving ? 'Guardando...' : 'Guardar orden'}
              </button>
            </div>

            {feedLoading ? (
              <p style={{ color: 'var(--text-tertiary)', fontSize: 13, fontFamily: f }}>Cargando...</p>
            ) : queuedItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', border: '2px dashed var(--border)', background: 'var(--bg-1)' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, fontFamily: f }}>No hay posts en cola</p>
                <Link href="/posts/new" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  marginTop: 12, fontFamily: f, fontSize: 12, color: 'var(--accent)',
                  textDecoration: 'none', fontWeight: 600,
                }}>
                  <Plus size={12} /> Crear contenido
                </Link>
              </div>
            ) : (
              <div style={{ border: '1px solid var(--border)' }}>
                {queuedItems.map((item, i) => (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    borderBottom: i < queuedItems.length - 1 ? '1px solid var(--border)' : 'none',
                    transition: 'background 0.15s',
                  }}>
                    <GripVertical size={14} style={{ color: 'var(--text-tertiary)', cursor: 'grab', flexShrink: 0 }} />
                    <div style={{ width: 36, height: 36, overflow: 'hidden', background: 'var(--bg-1)', flexShrink: 0 }}>
                      {item.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: f, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.caption?.slice(0, 48) ?? 'Sin caption'}
                      </p>
                      <p style={{ fontFamily: f, fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        {item.scheduledAt
                          ? `Programado · ${new Date(item.scheduledAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
                          : 'Pendiente de programar'}
                      </p>
                    </div>
                    <Link href={`/posts/${item.postId}`} style={{ color: 'var(--accent)', padding: 4 }}>
                      <Pencil size={13} />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: 3x3 IG grid preview */}
          <div>
            <div style={{ marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)', margin: 0 }}>
                Preview del feed
              </h2>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={gridQueued.map((item) => item.id)} strategy={rectSortingStrategy}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, border: '1px solid var(--border)' }}>
                  {gridQueued.map((item, i) => (
                    <SortableQueuedFeedCell key={item.id} item={item} index={i} />
                  ))}
                  {gridPublished.map((item) => (
                    <PublishedFeedCell key={item.id} item={item} />
                  ))}
                  {Array.from({ length: Math.max(0, 9 - gridQueued.length - gridPublished.length) }).map((_, i) => (
                    <div key={`empty-${i}`} style={{
                      aspectRatio: '1',
                      background: 'var(--bg-1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-tertiary)', fontSize: 18, opacity: 0.6,
                    }}>
                      <Plus size={18} />
                    </div>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <p style={{ marginTop: 12, color: 'var(--text-tertiary)', fontSize: 12, fontFamily: f, lineHeight: 1.5 }}>
              Posts en cola arriba, feed real de Instagram debajo.
            </p>
            {brand?.ig_username && (
              <a href={`https://instagram.com/${brand.ig_username}`} target="_blank" rel="noopener noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                marginTop: 12, fontFamily: f, fontSize: 11, color: 'var(--accent)',
                textDecoration: 'none', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                Ver Instagram real <ArrowRight size={12} />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
