'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store/useAppStore';

type FeedItem = {
  id:           string;
  post_id:      string | null;
  image_url:    string | null;
  position:     number;
  is_published: boolean;
  scheduled_at: string | null;
  posts?: {
    id:           string;
    image_url:    string | null;
    edited_image_url: string | null;
    caption:      string | null;
    status:       string;
    scheduled_at: string | null;
  };
};

const STATUS_COLOR: Record<string, string> = {
  draft:      '#6b7280',
  generated:  '#6b7280',
  pending:    '#f59e0b',
  approved:   '#3b82f6',
  scheduled:  '#3b82f6',
  published:  '#14B8A6',
};

const STATUS_LABEL: Record<string, string> = {
  draft:      'Borrador',
  generated:  'Generado',
  pending:    'En revisión NeuroPost',
  approved:   'Listo — Programado',
  scheduled:  'Programado',
  published:  'Publicado',
};

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Sortable row component
function SortableItem({ item, onDelete }: { item: FeedItem; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const post   = item.posts;
  const imgUrl = post?.edited_image_url ?? post?.image_url ?? item.image_url;
  const status = post?.status ?? (item.is_published ? 'published' : 'scheduled');
  const date   = item.scheduled_at ?? post?.scheduled_at;

  return (
    <div ref={setNodeRef} style={{
      ...style,
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
      background: '#fff', border: '1px solid var(--border)', borderRadius: 10,
      marginBottom: 8,
    }}>
      {/* Drag handle */}
      <div {...attributes} {...listeners} style={{ cursor: 'grab', color: '#ccc', padding: '0 4px', userSelect: 'none' }}>
        ≡
      </div>

      {/* Thumbnail */}
      <div style={{ width: 44, height: 44, borderRadius: 6, overflow: 'hidden', background: 'var(--surface)', flexShrink: 0 }}>
        {imgUrl && <img src={imgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {post?.caption?.slice(0, 50) ?? 'Sin caption'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
          {date ? formatDate(date) : 'Sin programar'} · Instagram
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR[status] ?? '#6b7280' }} />
          <span style={{ fontSize: 10, color: STATUS_COLOR[status] ?? '#6b7280', fontWeight: 600 }}>
            {STATUS_LABEL[status] ?? status}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6 }}>
        <a href={`/posts/${post?.id ?? ''}`} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--muted)' }}>
          ✎ Editar
        </a>
        <button onClick={() => onDelete(item.id)} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
          🗑
        </button>
      </div>
    </div>
  );
}

// Feed grid preview cell
function GridCell({ item, index }: { item: FeedItem | null; index: number }) {
  const imgUrl = item?.posts?.edited_image_url ?? item?.posts?.image_url ?? item?.image_url;
  const date   = item?.scheduled_at ?? item?.posts?.scheduled_at;
  const isReal = item?.is_published;

  return (
    <div style={{ position: 'relative', aspectRatio: '1', background: 'var(--bg-1)', borderRadius: 4, overflow: 'hidden' }}>
      {imgUrl ? (
        <img src={imgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 20 }}>📷</div>
      )}
      {isReal ? (
        <div style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(20,184,166,0.9)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4 }}>✓</div>
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: '#fff' }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{index + 1}</div>
            {date && <div style={{ fontSize: 8, marginTop: 2 }}>{new Date(date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MiFeedPage() {
  const brand   = useAppStore((s) => s.brand);
  const [items, setItems]   = useState<FeedItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const fetchQueue = useCallback(() => {
    setLoading(true);
    fetch('/api/worker/feed-queue').then((r) => r.json()).then((d) => {
      setItems(d.queue ?? []);
      setLoading(false);
    });
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.id === active.id);
      const newIndex = prev.findIndex((i) => i.id === over.id);
      return arrayMove(prev, oldIndex, newIndex).map((item: FeedItem, idx: number) => ({ ...item, position: idx }));
    });
  }

  async function saveOrder() {
    setSaving(true);
    const res = await fetch('/api/worker/feed-queue', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: items.map((item, idx) => ({ id: item.id, position: idx })) }),
    });
    if (res.ok) toast.success('Orden guardado');
    else toast.error('Error al guardar');
    setSaving(false);
  }

  function handleDelete(id: string) {
    if (!confirm('¿Eliminar de la cola?')) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
    // In a full implementation, call DELETE /api/worker/feed-queue
  }

  // Build the 3x3 preview grid: first row = last 3 published, rest = queue
  const published  = items.filter((i) => i.is_published).slice(-3);
  const queued     = items.filter((i) => !i.is_published).slice(0, 6);
  const gridCells  = [...published, ...queued].slice(0, 9);

  return (
    <div className="page-content" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Mi feed</h1>
          <p className="page-sub">Gestiona el orden de tus próximas publicaciones</p>
        </div>
        {brand?.ig_username && (
          <a href={`https://instagram.com/${brand.ig_username}`} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 13, color: 'var(--orange)', textDecoration: 'none', fontWeight: 600 }}>
            Ver mi Instagram real →
          </a>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>
        {/* Left: Sortable queue */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>Cola de publicación</h2>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Arrastra para cambiar el orden</p>
            </div>
            <button onClick={saveOrder} disabled={saving} className="btn-primary" style={{ fontSize: 12, padding: '7px 14px' }}>
              {saving ? 'Guardando...' : 'Guardar orden'}
            </button>
          </div>

          {loading ? (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Cargando...</p>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', border: '2px dashed var(--border)', borderRadius: 12 }}>
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>Tu cola está vacía</p>
              <a href="/posts/new" className="btn-primary" style={{ display: 'inline-block', marginTop: 12, fontSize: 13 }}>
                + Añadir contenido
              </a>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                {items.filter((i) => !i.is_published).map((item) => (
                  <SortableItem key={item.id} item={item} onDelete={handleDelete} />
                ))}
              </SortableContext>
            </DndContext>
          )}

          <a href="/posts/new" style={{ display: 'block', textAlign: 'center', padding: '12px', border: '1px dashed var(--border)', borderRadius: 10, color: 'var(--muted)', textDecoration: 'none', fontSize: 13, marginTop: 12 }}>
            + Añadir contenido a la cola
          </a>
        </div>

        {/* Right: IG grid preview */}
        <div>
          <div style={{ marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>Así quedará tu feed</h2>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              ✓ = ya publicado · números = próximos en cola
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <GridCell key={i} item={gridCells[i] ?? null} index={i - Math.min(published.length, 3)} />
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, textAlign: 'center', lineHeight: 1.5 }}>
            Los ✓ ya están en tu Instagram.<br />
            Los números son los próximos. Arrástralos para cambiar el orden.
          </p>
        </div>
      </div>
    </div>
  );
}
