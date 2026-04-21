'use client';

import { MediaPicker, type SelectedMedia } from '@/components/posts/MediaPicker';
import type { PerMediaMeta } from './types';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

interface Props {
  selected:  SelectedMedia[];
  perMedia:  Record<string, PerMediaMeta>;
  onChange:  (items: SelectedMedia[]) => void;
  onPerMedia:(id: string, patch: Partial<PerMediaMeta>) => void;
  maxPhotos: number;
}

export function Section1Media({ selected, perMedia, onChange, onPerMedia, maxPhotos }: Props) {
  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{
          fontFamily: fc, fontWeight: 900, fontSize: 22,
          textTransform: 'uppercase', letterSpacing: '0.02em',
          color: 'var(--text-primary)', marginBottom: 4,
        }}>
          1 — Fotos de referencia
        </h2>
        <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-secondary)' }}>
          Opcional. Sube fotos tuyas para que la IA las tome como base.
        </p>
      </div>

      <MediaPicker selected={selected} onChange={onChange} max={maxPhotos} hideLabel />

      {selected.length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {selected.map((item) => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '10px 12px', border: '1px solid var(--border)',
              background: 'var(--bg)',
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url} alt=""
                style={{ width: 52, height: 52, objectFit: 'cover', flexShrink: 0 }}
              />
              <div style={{ flex: 1 }}>
                <input
                  type="text"
                  placeholder="Nota para esta foto (opcional)…"
                  value={perMedia[item.id]?.note ?? ''}
                  onChange={(e) => onPerMedia(item.id, { note: e.target.value })}
                  style={{
                    width: '100%', border: '1px solid var(--border)', padding: '6px 8px',
                    fontFamily: f, fontSize: 12, background: 'var(--bg)', color: 'var(--text-primary)',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
