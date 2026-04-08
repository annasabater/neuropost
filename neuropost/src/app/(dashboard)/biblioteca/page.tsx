'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, Trash2, Check, Image, Film, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { createBrowserClient } from '@/lib/supabase';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

type MediaItem = {
  id: string;
  url: string;
  type: 'image' | 'video';
  name: string;
  created_at: string;
  source: 'upload' | 'instagram';
};

export default function BibliotecaPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = filter === 'all' ? items : items.filter(i => i.type === filter);

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (validFiles.length === 0) { toast.error('Solo imágenes y vídeos'); return; }

    setUploading(true);
    const supabase = createBrowserClient();

    for (const file of validFiles) {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `biblioteca/${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage.from('posts').upload(path, file, { contentType: file.type });
      if (error) { toast.error(`Error subiendo ${file.name}`); continue; }

      const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(path);

      const newItem: MediaItem = {
        id: crypto.randomUUID(),
        url: publicUrl,
        type: file.type.startsWith('video/') ? 'video' : 'image',
        name: file.name,
        created_at: new Date().toISOString(),
        source: 'upload',
      };
      setItems(prev => [newItem, ...prev]);
    }
    setUploading(false);
    toast.success(`${validFiles.length} archivo(s) subido(s)`);
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }

  function deleteSelected() {
    if (selected.size === 0) return;
    setItems(prev => prev.filter(i => !selected.has(i.id)));
    toast.success(`${selected.size} elemento(s) eliminado(s)`);
    setSelected(new Set());
  }

  return (
    <div className="page-content" style={{ maxWidth: 1000 }}>
      {/* Header */}
      <div style={{ padding: '48px 0 32px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: '#111827', lineHeight: 0.95, marginBottom: 8 }}>
            Biblioteca
          </h1>
          <p style={{ color: '#6b7280', fontSize: 15, fontFamily: f }}>
            Tu contenido visual en un solo lugar
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {selected.size > 0 && (
            <button onClick={deleteSelected} style={{
              padding: '8px 16px', background: '#ffffff', color: '#c62828',
              borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', borderLeft: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb',
              fontFamily: f, fontSize: 12, fontWeight: 600, cursor: 'pointer',
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
            transition: 'all 0.15s',
          }}>
            {l} {count > 0 && <span style={{ color: '#d1d5db', marginLeft: 4 }}>{count}</span>}
          </button>
        ))}
      </div>

      {/* Drop zone + grid */}
      {items.length === 0 ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragOver ? '#111827' : '#e5e7eb'}`,
            padding: '80px 20px', textAlign: 'center',
            transition: 'border-color 0.15s, background 0.15s',
            background: dragOver ? '#f9fafb' : '#ffffff',
            cursor: 'pointer',
          }}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={32} style={{ color: '#d1d5db', marginBottom: 16 }} />
          <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 22, textTransform: 'uppercase', color: '#111827', marginBottom: 8 }}>
            {uploading ? 'Subiendo...' : 'Arrastra archivos aquí'}
          </p>
          <p style={{ fontFamily: f, fontSize: 14, color: '#9ca3af', marginBottom: 24 }}>
            o haz clic para seleccionar. JPG, PNG, WEBP, MP4.
          </p>
          <div style={{
            display: 'inline-block', padding: '10px 24px', background: '#111827', color: '#ffffff',
            fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            Seleccionar archivos
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{ background: dragOver ? '#f9fafb' : 'transparent', transition: 'background 0.15s' }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: '#e5e7eb', border: '1px solid #e5e7eb' }}>
            {filtered.map((item) => {
              const isSelected = selected.has(item.id);
              return (
                <div key={item.id} onClick={() => toggleSelect(item.id)} style={{
                  position: 'relative', background: '#ffffff', cursor: 'pointer',
                  transition: 'opacity 0.15s',
                }}>
                  {item.type === 'video' ? (
                    <div style={{ aspectRatio: '1', background: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Film size={32} style={{ color: '#6b7280' }} />
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt={item.name} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                  )}

                  {/* Selection overlay */}
                  {isSelected && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,118,110,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 28, height: 28, background: '#0F766E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={16} color="#ffffff" />
                      </div>
                    </div>
                  )}

                  {/* Source badge */}
                  {item.source === 'instagram' && (
                    <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,0.6)', color: '#fff', fontFamily: f, fontSize: 9, fontWeight: 600, padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Instagram
                    </div>
                  )}

                  {/* Type badge */}
                  {item.type === 'video' && (
                    <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', color: '#fff', fontFamily: f, fontSize: 9, fontWeight: 600, padding: '2px 6px' }}>
                      Video
                    </div>
                  )}

                  {/* Info */}
                  <div style={{ padding: '8px 10px' }}>
                    <p style={{ fontFamily: f, fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Drop hint when has items */}
          {dragOver && (
            <div style={{ padding: 16, textAlign: 'center', background: '#f9fafb', borderTop: '1px solid #e5e7eb' }}>
              <p style={{ fontFamily: f, fontSize: 13, color: '#111827', fontWeight: 600 }}>Suelta para subir</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
