'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, ImageIcon, Film, Download } from 'lucide-react';
import toast from 'react-hot-toast';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

const C = {
  bg: '#ffffff',
  bg1: '#f3f4f6',
  card: '#ffffff',
  border: '#e5e7eb',
  text: '#111111',
  muted: '#6b7280',
  accent: '#0F766E',
};

type MediaItem = {
  id: string;
  brand_id: string;
  storage_path: string;
  url: string;
  type: 'image' | 'video';
  mime_type: string | null;
  size_bytes: number | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  created_at: string;
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function BibliotecaTab({ brandId }: { brandId: string }) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');
  const [preview, setPreview] = useState<MediaItem | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/worker/clientes/${brandId}/biblioteca`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Error');
        setMedia(data.media ?? []);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al cargar');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [brandId]);

  const filtered = useMemo(
    () => media.filter((m) => filter === 'all' || m.type === filter),
    [media, filter],
  );

  const imageCount = media.filter((m) => m.type === 'image').length;
  const videoCount = media.filter((m) => m.type === 'video').length;

  return (
    <div style={{ fontFamily: f, color: C.text }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {([['all', 'Todos', media.length], ['image', 'Imágenes', imageCount], ['video', 'Vídeos', videoCount]] as const).map(([k, label, n]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            style={{
              padding: '8px 16px', background: filter === k ? C.accent : C.card,
              color: filter === k ? '#fff' : C.muted,
              border: `1px solid ${filter === k ? C.accent : C.border}`,
              fontFamily: fc, fontSize: 12, fontWeight: 800, textTransform: 'uppercase',
              letterSpacing: '0.05em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            {label} <span style={{ fontSize: 10, opacity: 0.7 }}>{n}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: C.muted, background: C.card, border: `1px solid ${C.border}` }}>
          Cargando biblioteca…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 80, textAlign: 'center', background: C.card, border: `1px solid ${C.border}` }}>
          <BookOpen size={48} color={C.muted} style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontFamily: fc, fontSize: 18, fontWeight: 900, margin: '0 0 6px', textTransform: 'uppercase' }}>
            Sin archivos
          </h3>
          <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>
            Este cliente todavía no ha subido nada a su biblioteca.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
          {filtered.map((m) => (
            <div
              key={m.id}
              onClick={() => setPreview(m)}
              style={{ background: C.card, border: `1px solid ${C.border}`, cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
            >
              <div style={{ aspectRatio: '1', background: C.bg1, position: 'relative', overflow: 'hidden' }}>
                {m.type === 'image' ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <video src={m.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                )}
                <div style={{
                  position: 'absolute', top: 8, right: 8, padding: '3px 6px',
                  background: 'rgba(0,0,0,0.7)', color: '#fff',
                  fontSize: 10, fontWeight: 800, fontFamily: fc, textTransform: 'uppercase',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  {m.type === 'image' ? <ImageIcon size={10} /> : <Film size={10} />} {m.type}
                </div>
              </div>
              <div style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: C.muted, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{formatBytes(m.size_bytes)}</span>
                  {m.type === 'video' && <span>{formatDuration(m.duration)}</span>}
                  {m.type === 'image' && m.width && m.height && <span>{m.width}×{m.height}</span>}
                </div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 3, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {new Date(m.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 40,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: C.bg, maxWidth: 900, maxHeight: '90vh', border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, maxHeight: '70vh' }}>
              {preview.type === 'image' ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={preview.url} alt="" style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
              ) : (
                <video src={preview.url} controls style={{ maxWidth: '100%', maxHeight: '70vh' }} />
              )}
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, color: C.muted }}>
                {formatBytes(preview.size_bytes)}
                {preview.width && preview.height && ` · ${preview.width}×${preview.height}`}
                {preview.duration && ` · ${formatDuration(preview.duration)}`}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <a
                  href={preview.url}
                  target="_blank"
                  rel="noopener"
                  download
                  style={{
                    padding: '8px 14px', background: C.accent, color: '#fff', textDecoration: 'none',
                    fontFamily: fc, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Download size={12} /> Descargar
                </a>
                <button
                  onClick={() => setPreview(null)}
                  style={{
                    padding: '8px 14px', background: 'transparent', color: C.muted, border: `1px solid ${C.border}`,
                    fontFamily: fc, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                    cursor: 'pointer',
                  }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
