'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Trash2, Check, Play } from 'lucide-react';
import toast from 'react-hot-toast';
import { createBrowserClient } from '@/lib/supabase';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

type MediaItem = {
  id: string;
  storage_path: string;
  url: string;
  type: 'image' | 'video';
  duration: number | null;
  created_at: string;
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Extracts video duration (seconds) from a File via a temporary <video> element */
function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      resolve(video.duration);
      URL.revokeObjectURL(video.src);
    };
    video.onerror = () => resolve(0);
    video.src = URL.createObjectURL(file);
  });
}

export default function BibliotecaPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [brandId, setBrandId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createBrowserClient();

  // Get brand for current user
  useEffect(() => {
    async function loadBrand() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('brands').select('id').eq('user_id', user.id).single();
      if (data) setBrandId(data.id);
    }
    loadBrand();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load media from database
  useEffect(() => {
    if (!brandId) return;
    async function loadMedia() {
      const { data, error } = await supabase
        .from('media_library')
        .select('id, storage_path, url, type, duration, created_at')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error || !data) { setLoading(false); return; }
      setItems(data as MediaItem[]);
      setLoading(false);
    }
    loadMedia();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  const filtered = filter === 'all' ? items : items.filter(i => i.type === filter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function handleFilterChange(v: 'all' | 'image' | 'video') { setFilter(v); setPage(1); }

  function toggleSelect(id: string) {
    setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    if (!brandId) { toast.error('No se encontró la marca'); return; }
    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (validFiles.length === 0) { toast.error('Solo imágenes y vídeos'); return; }

    setUploading(true);
    let uploaded = 0;

    for (const file of validFiles) {
      const isVideo = file.type.startsWith('video/');
      const ext = file.name.split('.').pop() ?? 'jpg';
      const fileId = crypto.randomUUID();
      const storagePath = `biblioteca/${fileId}.${ext}`;

      // Show optimistic preview
      const previewUrl = URL.createObjectURL(file);
      const duration = isVideo ? await getVideoDuration(file) : null;

      const tempItem: MediaItem = {
        id: fileId,
        storage_path: storagePath,
        url: previewUrl,
        type: isVideo ? 'video' : 'image',
        duration,
        created_at: new Date().toISOString(),
      };
      setItems(prev => [tempItem, ...prev]);

      // Upload to storage
      const { error: uploadErr } = await supabase.storage.from('posts').upload(storagePath, file, { contentType: file.type });
      if (uploadErr) { toast.error(`Error: ${file.name}`); continue; }

      const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(storagePath);

      // Insert into database
      const { data: row, error: dbErr } = await supabase.from('media_library').insert({
        brand_id: brandId,
        storage_path: storagePath,
        url: publicUrl,
        type: isVideo ? 'video' : 'image',
        mime_type: file.type,
        size_bytes: file.size,
        duration: duration ?? null,
      }).select('id').single();

      if (dbErr) { toast.error(`Error guardando ${file.name}`); continue; }

      // Replace temp item with real DB row
      setItems(prev => prev.map(item =>
        item.id === fileId ? { ...item, id: row.id, url: publicUrl, storage_path: storagePath } : item
      ));
      uploaded++;
    }

    setUploading(false);
    if (uploaded > 0) {
      toast.success(`${uploaded} archivo(s) subido(s)`);
      // Notify system of first upload (triggers onboarding content if applicable)
      fetch('/api/biblioteca/notify-upload', { method: 'POST' }).catch(() => null);
    }
  }, [brandId, supabase]);

  function handleDrop(e: React.DragEvent) { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }

  async function deleteSelected() {
    if (selected.size === 0) return;
    const toDelete = items.filter(i => selected.has(i.id));

    // Delete from storage and DB
    const storagePaths = toDelete.map(i => i.storage_path);
    const dbIds = toDelete.map(i => i.id);

    await supabase.storage.from('posts').remove(storagePaths);
    await supabase.from('media_library').delete().in('id', dbIds);

    setItems(prev => prev.filter(i => !selected.has(i.id)));
    toast.success(`${selected.size} eliminado(s)`);
    setSelected(new Set());
  }

  return (
    <div className="page-content dashboard-unified-page" style={{ maxWidth: 1000 }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="dashboard-unified-header" style={{ padding: '48px 0 32px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: '#111827', lineHeight: 0.95, marginBottom: 8 }}>
            Biblioteca
          </h1>
          <p style={{ color: '#6b7280', fontSize: 15, fontFamily: f }}>Tu contenido visual en un solo lugar</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {selected.size > 0 && (
            <button onClick={deleteSelected} style={{
              padding: '8px 16px', background: '#ffffff', color: '#c62828',
              border: '1px solid #e5e7eb', fontFamily: f, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Trash2 size={13} /> Eliminar ({selected.size})
            </button>
          )}
          <button onClick={() => fileRef.current?.click()} style={{
            padding: '8px 20px', background: '#111827', color: '#ffffff', border: 'none',
            fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Upload size={14} /> Subir contenido
          </button>
          <input ref={fileRef} type="file" multiple accept="image/*,video/*" style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ''; }} />
        </div>
      </div>

      {/* Drag overlay */}
      {dragOver && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ background: '#ffffff', padding: '40px 60px', textAlign: 'center' }}>
            <Upload size={32} style={{ color: '#111827', marginBottom: 12 }} />
            <p style={{ fontFamily: fc, fontSize: 20, fontWeight: 900, textTransform: 'uppercase', color: '#111827' }}>Suelta para subir</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid #e5e7eb', marginBottom: 24 }}>
        {[
          { v: 'all' as const, l: 'Todo', count: items.length },
          { v: 'image' as const, l: 'Imágenes', count: items.filter(i => i.type === 'image').length },
          { v: 'video' as const, l: 'Vídeos', count: items.filter(i => i.type === 'video').length },
        ].map(({ v, l, count }) => (
          <button key={v} onClick={() => handleFilterChange(v)} style={{
            background: 'none', border: 'none', cursor: 'pointer', paddingBottom: 12,
            fontFamily: f, fontSize: 13, fontWeight: 500,
            color: filter === v ? '#111827' : '#9ca3af',
            borderBottom: filter === v ? '2px solid #111827' : '2px solid transparent',
          }}>
            {l} {count > 0 && <span style={{ color: '#d1d5db', marginLeft: 4 }}>{count}</span>}
          </button>
        ))}
      </div>

      {/* Unified drop zone + gallery */}
      <div style={{ position: 'relative', minHeight: 200 }}>
        {/* Loading skeleton */}
        {loading && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {Array.from({ length: 8 }).map((_, i) => <div key={i} style={{ flex: '1 1 220px', minWidth: 0 }}><div style={{ aspectRatio: '1', background: '#f3f4f6' }} /></div>)}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div onClick={() => fileRef.current?.click()} style={{ padding: '80px 20px', textAlign: 'center', cursor: 'pointer' }}>
            <Upload size={32} style={{ color: '#d1d5db', marginBottom: 16 }} />
            <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 22, textTransform: 'uppercase', color: '#111827', marginBottom: 8 }}>
              {uploading ? 'Subiendo...' : 'Arrastra archivos aquí'}
            </p>
            <p style={{ fontFamily: f, fontSize: 14, color: '#9ca3af', marginBottom: 24 }}>o haz clic para seleccionar. JPG, PNG, WEBP, MP4.</p>
            <div style={{ display: 'inline-block', padding: '10px 24px', background: '#111827', color: '#ffffff', fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Seleccionar archivos
            </div>
          </div>
        )}

        {/* Grid */}
        {!loading && filtered.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {pagedItems.map((item) => {
              const isSel = selected.has(item.id);
              return (
                <div key={item.id} onClick={() => toggleSelect(item.id)} style={{ position: 'relative', background: '#000', cursor: 'pointer', flex: '1 1 220px', minWidth: 0 }}>
                  {item.type === 'video' ? (
                    <div style={{ position: 'relative' }}>
                      <video
                        src={item.url}
                        muted
                        preload="metadata"
                        style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                      />
                      {/* Play icon overlay */}
                      <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(0,0,0,0.15)', pointerEvents: 'none',
                      }}>
                        <Play size={28} fill="#fff" color="#fff" style={{ opacity: 0.85 }} />
                      </div>
                      {/* Duration badge */}
                      {item.duration != null && item.duration > 0 && (
                        <div style={{
                          position: 'absolute', bottom: 6, right: 6,
                          background: 'rgba(0,0,0,0.7)', color: '#fff',
                          fontFamily: f, fontSize: 11, fontWeight: 600,
                          padding: '2px 6px', borderRadius: 2,
                        }}>
                          {formatDuration(item.duration)}
                        </div>
                      )}
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                  )}
                  {/* Selection overlay */}
                  {isSel && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,118,110,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 28, height: 28, background: '#0F766E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={16} color="#ffffff" /></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Drag hover overlay */}
        {dragOver && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(17,24,39,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
            <div style={{ background: '#ffffff', padding: '24px 40px', textAlign: 'center' }}>
              <Upload size={24} style={{ color: '#111827', marginBottom: 8 }} />
              <p style={{ fontFamily: fc, fontSize: 16, fontWeight: 900, textTransform: 'uppercase', color: '#111827' }}>Suelta para subir</p>
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && filtered.length > 0 && totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 24 }}>
          <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
            style={{ padding: '8px 14px', border: '1px solid #e5e7eb', background: '#ffffff', color: '#111827', fontFamily: f, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.4 : 1 }}>← Anterior</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
            <button type="button" key={n} onClick={() => setPage(n)}
              style={{ minWidth: 36, padding: '8px 12px', border: '1px solid #e5e7eb', background: n === currentPage ? '#111827' : '#ffffff', color: n === currentPage ? '#ffffff' : '#111827', fontFamily: f, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{n}</button>
          ))}
          <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
            style={{ padding: '8px 14px', border: '1px solid #e5e7eb', background: '#ffffff', color: '#111827', fontFamily: f, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.4 : 1 }}>Siguiente →</button>
        </div>
      )}

      {/* Hint below grid */}
      {!loading && filtered.length > 0 && (
        <p style={{ fontFamily: f, fontSize: 11, color: '#d1d5db', marginTop: 10, textAlign: 'center' }}>
          Arrastra archivos aquí para subir más contenido
        </p>
      )}
      {uploading && <p style={{ fontFamily: f, fontSize: 12, color: '#0F766E', marginTop: 8, textAlign: 'center' }}>Subiendo archivos...</p>}
    </div>
  );
}
