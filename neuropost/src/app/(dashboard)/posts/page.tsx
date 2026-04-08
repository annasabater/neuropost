'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Grid3x3, LayoutList, GripVertical, Pencil, ArrowRight } from 'lucide-react';
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

type FeedItem = {
  id: string; post_id: string | null; image_url: string | null;
  position: number; is_published: boolean; scheduled_at: string | null;
  posts?: { id: string; image_url: string | null; edited_image_url: string | null; caption: string | null; status: string; scheduled_at: string | null };
};

// ── Sortable feed cell ──
function SortableFeedCell({ item, index }: { item: FeedItem; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const imgUrl = item.posts?.edited_image_url ?? item.posts?.image_url ?? item.image_url;
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={{
      transform: CSS.Transform.toString(transform), transition,
      opacity: isDragging ? 0.4 : 1, aspectRatio: '1',
      position: 'relative', overflow: 'hidden', cursor: 'grab',
      background: 'var(--bg-1)',
    }}>
      {imgUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 20 }}>
          📷
        </div>
      )}
      {item.is_published ? (
        <div style={{ position: 'absolute', top: 6, right: 6, background: 'var(--accent)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 6px', fontFamily: f }}>
          ✓
        </div>
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: fc, fontSize: 28, fontWeight: 900, color: '#fff' }}>{index + 1}</span>
        </div>
      )}
    </div>
  );
}

export default function PostsPage() {
  const t = useTranslations('posts');
  const brand = useAppStore((s) => s.brand);
  const setPosts = useAppStore((s) => s.setPosts);
  const storePostList = useAppStore((s) => s.posts);

  const [posts, setPosts_] = useState<Post[]>([]);
  const [filter, setFilter] = useState<PostStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'feed'>('grid');

  // Feed queue state
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const STATUS_FILTERS: { value: PostStatus | 'all'; label: string }[] = [
    { value: 'all',       label: t('status.all') },
    { value: 'draft',     label: t('status.draft') },
    { value: 'pending',   label: t('status.pending') },
    { value: 'approved',  label: t('status.approved') },
    { value: 'scheduled', label: t('status.scheduled') },
    { value: 'published', label: t('status.published') },
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
    fetch('/api/worker/feed-queue').then((r) => r.json()).then((d) => {
      setFeedItems(d.queue ?? []);
    }).finally(() => setFeedLoading(false));
  }, []);

  useEffect(() => { if (view === 'feed') fetchFeed(); }, [view, fetchFeed]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setFeedItems((prev) => {
      const oldIdx = prev.findIndex((i) => i.id === active.id);
      const newIdx = prev.findIndex((i) => i.id === over.id);
      return arrayMove(prev, oldIdx, newIdx).map((item, idx) => ({ ...item, position: idx }));
    });
  }

  async function saveFeedOrder() {
    setSaving(true);
    const res = await fetch('/api/worker/feed-queue', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: feedItems.map((item, idx) => ({ id: item.id, position: idx })) }),
    });
    if (res.ok) toast.success('Orden guardado');
    else toast.error('Error al guardar');
    setSaving(false);
  }

  const filtered = filter === 'all' ? posts : posts.filter((p) => p.status === filter);
  const published = feedItems.filter((i) => i.is_published).slice(-3);
  const queued = feedItems.filter((i) => !i.is_published);
  const gridCells = [...published, ...queued].slice(0, 9);

  return (
    <div className="page-content" style={{ maxWidth: 1000 }}>
      {/* ── Header ── */}
      <div style={{ padding: '48px 0 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{
            fontFamily: fc, fontWeight: 900,
            fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
            textTransform: 'uppercase', letterSpacing: '0.01em',
            color: 'var(--text-primary)', lineHeight: 0.95, marginBottom: 12,
          }}>
            Contenido
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, fontFamily: f }}>
            Gestiona y organiza tus publicaciones
          </p>
        </div>
        <Link href="/posts/new" style={{
          background: 'var(--text-primary)', color: 'var(--bg)',
          padding: '10px 24px', textDecoration: 'none',
          fontFamily: fc, fontSize: 12, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          flexShrink: 0,
        }}>
          <Plus size={14} /> {t('new.title')}
        </Link>
      </div>

      {/* ── View switcher + filters ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)', marginBottom: 24, paddingBottom: 0,
      }}>
        {/* Filters (only in grid view) */}
        <div style={{ display: 'flex', gap: 24 }}>
          {view === 'grid' && STATUS_FILTERS.map((sf) => (
            <button
              key={sf.value}
              onClick={() => setFilter(sf.value)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: f, fontSize: 13, fontWeight: 500,
                color: filter === sf.value ? 'var(--text-primary)' : 'var(--text-tertiary)',
                paddingBottom: 12,
                borderBottom: filter === sf.value ? '2px solid var(--text-primary)' : '2px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              {sf.label}
            </button>
          ))}
          {view === 'feed' && (
            <span style={{ fontFamily: f, fontSize: 13, color: 'var(--text-tertiary)', paddingBottom: 12 }}>
              Arrastra para cambiar el orden · ✓ = publicado
            </span>
          )}
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', marginBottom: -1 }}>
          <button onClick={() => setView('grid')} style={{
            padding: '8px 14px', background: view === 'grid' ? 'var(--text-primary)' : 'var(--bg)',
            color: view === 'grid' ? 'var(--bg)' : 'var(--text-tertiary)',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            <LayoutList size={14} /> Posts
          </button>
          <button onClick={() => setView('feed')} style={{
            padding: '8px 14px', background: view === 'feed' ? 'var(--text-primary)' : 'var(--bg)',
            color: view === 'feed' ? 'var(--bg)' : 'var(--text-tertiary)',
            border: 'none', borderLeft: '1px solid var(--border)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            <Grid3x3 size={14} /> Feed
          </button>
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
            <div style={{ textAlign: 'center', padding: '80px 20px' }}>
              <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 24, textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 8 }}>
                {t('empty.title')}
              </p>
              <p style={{ fontSize: 14, color: 'var(--text-tertiary)', fontFamily: f, marginBottom: 32 }}>
                {t('empty.subtitle')}
              </p>
              <Link href="/posts/new" style={{
                background: 'var(--text-primary)', color: 'var(--bg)',
                padding: '14px 32px', textDecoration: 'none',
                fontFamily: fc, fontSize: 13, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                {t('new.title')}
              </Link>
            </div>
          ) : (
            <div className="dash-grid-auto" style={{
              background: 'var(--border)', border: '1px solid var(--border)',
            }}>
              {filtered.map((post) => (
                <Link key={post.id} href={`/posts/${post.id}`} style={{
                  background: 'var(--bg)', textDecoration: 'none', color: 'inherit',
                  display: 'block', position: 'relative', overflow: 'hidden',
                  transition: 'background 0.15s',
                }}>
                  {/* Image */}
                  <div style={{ aspectRatio: '1', background: 'var(--bg-1)', overflow: 'hidden' }}>
                    {post.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: 'var(--text-tertiary)' }}>
                        📸
                      </div>
                    )}
                  </div>
                  {/* Status badge */}
                  <div style={{ position: 'absolute', top: 8, left: 8 }}>
                    <span className={`status-badge status-${post.status}`}>{post.status}</span>
                  </div>
                  {/* Info */}
                  <div style={{ padding: '12px 14px' }}>
                    <p style={{
                      fontFamily: f, fontSize: 13, color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4,
                    }}>
                      {post.caption ? post.caption.slice(0, 60) : t('noCaption')}
                    </p>
                    <p style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {new Date(post.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── FEED VIEW ── */}
      {view === 'feed' && (
        <div className="dash-grid-2" style={{ gap: 32, alignItems: 'start' }}>
          {/* Left: queue list */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-tertiary)', margin: 0 }}>
                Cola de publicación
              </h2>
              <button onClick={saveFeedOrder} disabled={saving} style={{
                background: 'var(--text-primary)', color: 'var(--bg)',
                border: 'none', padding: '6px 16px', cursor: 'pointer',
                fontFamily: f, fontSize: 11, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.06em',
                opacity: saving ? 0.5 : 1,
              }}>
                {saving ? 'Guardando...' : 'Guardar orden'}
              </button>
            </div>

            {feedLoading ? (
              <p style={{ color: 'var(--text-tertiary)', fontSize: 13, fontFamily: f }}>Cargando...</p>
            ) : queued.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', border: '1px dashed var(--border)' }}>
                <p style={{ color: 'var(--text-tertiary)', fontSize: 13, fontFamily: f }}>Cola vacía</p>
                <Link href="/posts/new" style={{
                  display: 'inline-block', marginTop: 12,
                  fontFamily: f, fontSize: 12, color: 'var(--text-primary)',
                  textDecoration: 'underline', textUnderlineOffset: 3,
                }}>
                  + Crear contenido
                </Link>
              </div>
            ) : (
              <div style={{ border: '1px solid var(--border)' }}>
                {queued.map((item, i) => {
                  const post = item.posts;
                  const imgUrl = post?.edited_image_url ?? post?.image_url ?? item.image_url;
                  return (
                    <div key={item.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                      borderBottom: i < queued.length - 1 ? '1px solid var(--border)' : 'none',
                      transition: 'background 0.15s',
                    }}>
                      <GripVertical size={14} style={{ color: 'var(--text-tertiary)', cursor: 'grab', flexShrink: 0 }} />
                      <div style={{ width: 36, height: 36, overflow: 'hidden', background: 'var(--bg-1)', flexShrink: 0 }}>
                        {imgUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: f, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {post?.caption?.slice(0, 40) ?? 'Sin caption'}
                        </p>
                        <p style={{ fontFamily: f, fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                          {item.scheduled_at ? new Date(item.scheduled_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : 'Sin programar'}
                        </p>
                      </div>
                      <Link href={`/posts/${post?.id ?? ''}`} style={{ color: 'var(--text-tertiary)', padding: 4 }}>
                        <Pencil size={13} />
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: 3x3 IG grid preview */}
          <div>
            <div style={{ marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-tertiary)', margin: 0 }}>
                Preview del feed
              </h2>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={gridCells.map(i => i.id)} strategy={rectSortingStrategy}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
                  {gridCells.map((item, i) => (
                    <SortableFeedCell key={item.id} item={item} index={i - Math.min(published.length, 3)} />
                  ))}
                  {/* Empty cells if less than 9 */}
                  {Array.from({ length: Math.max(0, 9 - gridCells.length) }).map((_, i) => (
                    <div key={`empty-${i}`} style={{ aspectRatio: '1', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>
                      +
                    </div>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            {brand?.ig_username && (
              <a href={`https://instagram.com/${brand.ig_username}`} target="_blank" rel="noopener noreferrer" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                marginTop: 16, fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)',
                textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.06em',
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
