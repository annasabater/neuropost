'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Trash2, Check, Film } from 'lucide-react';
import toast from 'react-hot-toast';
import { createBrowserClient } from '@/lib/supabase';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

type MediaItem = { id: string; url: string; type: 'image' | 'video'; name: string; created_at: string };

export default function BibliotecaPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createBrowserClient();

  // Load existing files from Supabase Storage
  useEffect(() => {
    async function loadFiles() {
      const { data, error } = await supabase.storage.from('posts').list('biblioteca', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
      if (error || !data) { setLoading(false); return; }
      const loaded: MediaItem[] = data
        .filter(f => !f.name.startsWith('.'))
        .map(f => {
          const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(`biblioteca/${f.name}`);
          const isVideo = /\.(mp4|mov|webm|avi)$/i.test(f.name);
          return { id: f.id ?? f.name, url: publicUrl, type: isVideo ? 'video' as const : 'image' as const, name: f.name, created_at: f.created_at ?? new Date().toISOString() };
        });
      setItems(loaded);
      setLoading(false);
    }
    loadFiles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = filter === 'all' ? items : items.filter(i => i.type === filter);

  function toggleSelect(id: string) {
    setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (validFiles.length === 0) { toast.error('Solo imágenes y vídeos'); return; }

    // Add immediately with local preview
    const newItems: MediaItem[] = validFiles.map(file => ({
      id: crypto.randomUUID(),
      url: URL.createObjectURL(file),
      type: (file.type.startsWith('video/') ? 'video' : 'image') as 'image' | 'video',
      name: file.name,
      created_at: new Date().toISOString(),
    }));
    setItems(prev => [...newItems, ...prev]);

    // Upload to Supabase in background
    setUploading(true);
    let uploaded = 0;
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `biblioteca/${newItems[i].id}.${ext}`;
      const { error } = await supabase.storage.from('posts').upload(path, file, { contentType: file.type });
      if (error) { toast.error(`Error: ${file.name}`); continue; }
      // Update URL from local blob to public URL
      const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(path);
      setItems(prev => prev.map(item => item.id === newItems[i].id ? { ...item, url: publicUrl, id: path } : item));
      uploaded++;
    }
    setUploading(false);
    if (uploaded > 0) toast.success(`${uploaded} archivo(s) subido(s)`);
  }, [supabase]);

  function handleDrop(e: React.DragEvent) { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }

  async function deleteSelected() {
    if (selected.size === 0) return;
    for (const id of selected) {
      await supabase.storage.from('posts').remove([id]);
    }
    setItems(prev => prev.filter(i => !selected.has(i.id)));
    toast.success(`${selected.size} eliminado(s)`);
    setSelected(new Set());
  }

  return (
    <div className="page-content" style={{ maxWidth: 1000 }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div style={{ padding: '48px 0 32px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
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
          <button key={v} onClick={() => setFilter(v)} style={{
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
      <div style={{ border: '1px solid #e5e7eb', position: 'relative', minHeight: 200 }}>
        {/* Loading skeleton */}
        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: '#e5e7eb' }}>
            {Array.from({ length: 8 }).map((_, i) => <div key={i} style={{ background: '#ffffff' }}><div style={{ aspectRatio: '1', background: '#f3f4f6' }} /></div>)}
          </div>
        )}

        {/* Empty state inside the zone */}
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

        {/* Grid inside the zone */}
        {!loading && filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: '#e5e7eb' }}>
            {filtered.map((item) => {
              const isSel = selected.has(item.id);
              return (
                <div key={item.id} onClick={() => toggleSelect(item.id)} style={{ position: 'relative', background: '#ffffff', cursor: 'pointer' }}>
                  {item.type === 'video' ? (
                    <div style={{ aspectRatio: '1', background: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Film size={32} style={{ color: '#6b7280' }} /></div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt={item.name} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                  )}
                  {isSel && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,118,110,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 28, height: 28, background: '#0F766E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={16} color="#ffffff" /></div>
                    </div>
                  )}
                  {item.type === 'video' && <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', color: '#fff', fontFamily: f, fontSize: 9, fontWeight: 600, padding: '2px 6px' }}>Video</div>}
                  <div style={{ padding: '6px 8px' }}><p style={{ fontFamily: f, fontSize: 10, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p></div>
                </div>
              );
            })}
          </div>
        )}

        {/* Drag hover overlay — always available */}
        {dragOver && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(17,24,39,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
            <div style={{ background: '#ffffff', padding: '24px 40px', textAlign: 'center' }}>
              <Upload size={24} style={{ color: '#111827', marginBottom: 8 }} />
              <p style={{ fontFamily: fc, fontSize: 16, fontWeight: 900, textTransform: 'uppercase', color: '#111827' }}>Suelta para subir</p>
            </div>
          </div>
        )}
      </div>

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
