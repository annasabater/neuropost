'use client';

import { useState, useEffect } from 'react';
import { Image as ImageIcon, Camera, Check, Play } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

export interface SelectedMedia {
  id: string;
  url: string;
  source: 'library' | 'instagram';
  type: 'image' | 'video';
}

type LibraryItem = {
  id: string;
  url: string;
  type: 'image' | 'video';
  duration: number | null;
};

type IGItem = {
  id: string;
  imageUrl: string | null;
  caption: string | null;
  permalink: string | null;
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface MediaPickerProps {
  selected: SelectedMedia[];
  onChange: (items: SelectedMedia[]) => void;
  max?: number;
}

export function MediaPicker({ selected, onChange, max = 10 }: MediaPickerProps) {
  const [tab, setTab] = useState<'library' | 'instagram'>('library');
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [igFeed, setIgFeed] = useState<IGItem[]>([]);
  const [igConnected, setIgConnected] = useState(false);
  const [loadingLib, setLoadingLib] = useState(true);
  const [loadingIg, setLoadingIg] = useState(true);
  const supabase = createBrowserClient();

  // Load library
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadingLib(false); return; }
      const { data: brand } = await supabase.from('brands').select('id').eq('user_id', user.id).single();
      if (!brand) { setLoadingLib(false); return; }

      const { data } = await supabase
        .from('media_library')
        .select('id, url, type, duration')
        .eq('brand_id', brand.id)
        .order('created_at', { ascending: false })
        .limit(50);

      setLibrary((data ?? []) as LibraryItem[]);
      setLoadingLib(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load Instagram feed
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/meta/feed-preview');
        if (!res.ok) { setLoadingIg(false); return; }
        const json = await res.json();
        setIgConnected(json.connected ?? false);
        setIgFeed((json.published ?? []) as IGItem[]);
      } catch { /* ignore */ }
      setLoadingIg(false);
    }
    load();
  }, []);

  const selectedIds = new Set(selected.map(s => s.id));

  function toggle(item: SelectedMedia) {
    if (selectedIds.has(item.id)) {
      onChange(selected.filter(s => s.id !== item.id));
    } else if (selected.length < max) {
      onChange([...selected, item]);
    }
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    background: active ? '#111827' : '#ffffff',
    color: active ? '#ffffff' : '#6b7280',
    borderTop: `1px solid ${active ? '#111827' : '#e5e7eb'}`,
    borderBottom: `1px solid ${active ? '#111827' : '#e5e7eb'}`,
    borderLeft: `1px solid ${active ? '#111827' : '#e5e7eb'}`,
    borderRight: `1px solid ${active ? '#111827' : '#e5e7eb'}`,
    fontFamily: f,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  });

  return (
    <div>
      <label style={{
        display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9ca3af', marginBottom: 8,
      }}>
        Adjuntar imágenes de referencia <span style={{ opacity: 0.5, textTransform: 'none', fontWeight: 400 }}>(opcional)</span>
      </label>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 12 }}>
        <button type="button" onClick={() => setTab('library')} style={{ ...tabStyle(tab === 'library'), borderRight: 'none' }}>
          <ImageIcon size={13} /> Biblioteca
        </button>
        <button type="button" onClick={() => setTab('instagram')} style={tabStyle(tab === 'instagram')}>
          <Camera size={13} /> Instagram
        </button>
      </div>

      {/* Grid */}
      <div style={{
        border: '1px solid #e5e7eb',
        maxHeight: 240,
        overflowY: 'auto',
        background: '#f9fafb',
      }}>
        {tab === 'library' && (
          loadingLib ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <p style={{ fontFamily: f, fontSize: 12, color: '#9ca3af' }}>Cargando biblioteca...</p>
            </div>
          ) : library.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <p style={{ fontFamily: f, fontSize: 12, color: '#9ca3af' }}>No hay contenido en tu biblioteca</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1px', background: '#e5e7eb' }}>
              {library.map((item) => {
                const isSel = selectedIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => toggle({ id: item.id, url: item.url, source: 'library', type: item.type })}
                    style={{ position: 'relative', cursor: 'pointer', background: '#000' }}
                  >
                    {item.type === 'video' ? (
                      <>
                        <video src={item.url} muted preload="metadata"
                          style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                        <div style={{
                          position: 'absolute', inset: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(0,0,0,0.15)', pointerEvents: 'none',
                        }}>
                          <Play size={18} fill="#fff" color="#fff" style={{ opacity: 0.85 }} />
                        </div>
                        {item.duration != null && item.duration > 0 && (
                          <div style={{
                            position: 'absolute', bottom: 4, right: 4,
                            background: 'rgba(0,0,0,0.7)', color: '#fff',
                            fontFamily: f, fontSize: 9, fontWeight: 600,
                            padding: '1px 4px', borderRadius: 2,
                          }}>
                            {formatDuration(item.duration)}
                          </div>
                        )}
                      </>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                    )}
                    {isSel && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(15,118,110,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <div style={{
                          width: 22, height: 22, background: '#0F766E',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Check size={13} color="#ffffff" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}

        {tab === 'instagram' && (
          loadingIg ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <p style={{ fontFamily: f, fontSize: 12, color: '#9ca3af' }}>Cargando feed...</p>
            </div>
          ) : !igConnected ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <Camera size={24} style={{ color: '#d1d5db', marginBottom: 8 }} />
              <p style={{ fontFamily: f, fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Instagram no conectado</p>
              <p style={{ fontFamily: f, fontSize: 11, color: '#d1d5db' }}>
                Conéctalo en Ajustes → Conexiones
              </p>
            </div>
          ) : igFeed.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <p style={{ fontFamily: f, fontSize: 12, color: '#9ca3af' }}>No se encontraron publicaciones</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1px', background: '#e5e7eb' }}>
              {igFeed.map((item) => {
                if (!item.imageUrl) return null;
                const isSel = selectedIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => toggle({ id: item.id, url: item.imageUrl!, source: 'instagram', type: 'image' })}
                    style={{ position: 'relative', cursor: 'pointer', background: '#000' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.imageUrl} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                    {isSel && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(15,118,110,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <div style={{
                          width: 22, height: 22, background: '#0F766E',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Check size={13} color="#ffffff" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Selection counter */}
      {selected.length > 0 && (
        <p style={{ fontFamily: f, fontSize: 11, color: '#0F766E', marginTop: 6 }}>
          {selected.length} {selected.length === 1 ? 'archivo seleccionado' : 'archivos seleccionados'}
        </p>
      )}
    </div>
  );
}
