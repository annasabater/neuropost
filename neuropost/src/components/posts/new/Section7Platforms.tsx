'use client';

import type { PostFormat } from '@/types';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

type Platform = 'instagram' | 'facebook' | 'tiktok';

const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: 'Instagram',
  facebook:  'Facebook',
  tiktok:    'TikTok',
};

interface Props {
  available: Platform[];
  value:     Platform[];
  format:    PostFormat;
  onChange:  (platforms: Platform[]) => void;
}

export function Section7Platforms({ available, value, format, onChange }: Props) {
  function toggle(p: Platform) {
    if (value.includes(p)) {
      const next = value.filter((x) => x !== p);
      if (next.length > 0) onChange(next);
    } else {
      onChange([...value, p]);
    }
  }

  const isVideo = format === 'video' || format === 'reel';

  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{
          fontFamily: fc, fontWeight: 900, fontSize: 22,
          textTransform: 'uppercase', letterSpacing: '0.02em',
          color: 'var(--text-primary)', marginBottom: 4,
        }}>
          6 — Plataformas
        </h2>
        <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-secondary)' }}>
          ¿Dónde quieres publicar?{isVideo ? ' (TikTok solo disponible para vídeos en el plan Pro o superior)' : ''}
        </p>
      </div>

      <div style={{ display: 'flex', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)' }}>
        {available.map((p) => {
          const active = value.includes(p);
          return (
            <button
              key={p}
              type="button"
              onClick={() => toggle(p)}
              style={{
                flex: 1, padding: '14px 16px', cursor: 'pointer',
                background: active ? '#111827' : 'var(--bg)',
                border: 'none', outline: 'none', textAlign: 'center',
              }}
            >
              <div style={{
                fontFamily: fc, fontWeight: 900, fontSize: 14,
                textTransform: 'uppercase', letterSpacing: '0.04em',
                color: active ? '#fff' : 'var(--text-primary)',
              }}>
                {PLATFORM_LABELS[p]}
              </div>
            </button>
          );
        })}
      </div>

      {available.length === 0 && (
        <p style={{ fontFamily: f, fontSize: 12, color: 'var(--text-secondary)', padding: '12px 0' }}>
          Conecta una plataforma en Ajustes → Conexiones.
        </p>
      )}
    </section>
  );
}
