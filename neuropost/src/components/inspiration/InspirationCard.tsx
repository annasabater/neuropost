'use client';

import { useState } from 'react';
import { Heart, ImageIcon, Film, LayoutGrid, Video, Send } from 'lucide-react';

const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

// ─── Types ────────────────────────────────────────────────────────────────────

export type InspirationOrigin = 'editorial' | 'user_saved' | 'ai_generated';

export type InspirationItem = {
  id:                string;
  type:              string;
  source_url:        string | null;
  thumbnail_url:     string | null;
  title:             string | null;
  notes:             string | null;
  style_tags:        string[] | null;
  tags:              string[];
  format:            string | null;
  is_favorite:       boolean;
  classified_at:     string | null;
  usage_count:       number;
  description_short: string | null;
  reusability_score: number | null;
  origin:            InspirationOrigin | null;
  source_handle:     string | null;
  created_at:        string;
  recreation?: {
    id: string;
    status: string;
    generated_images?: string[] | null;
  } | null;
};

// ─── Format badge ─────────────────────────────────────────────────────────────

const FORMAT_META: Record<string, { label: string; icon: React.ReactNode }> = {
  image:    { label: 'Imagen',   icon: <ImageIcon  size={8} /> },
  imagen:   { label: 'Imagen',   icon: <ImageIcon  size={8} /> },
  foto:     { label: 'Imagen',   icon: <ImageIcon  size={8} /> },
  reel:     { label: 'Reel',     icon: <Film       size={8} /> },
  video:    { label: 'Video',    icon: <Video      size={8} /> },
  carousel: { label: 'Carrusel', icon: <LayoutGrid size={8} /> },
  carrusel: { label: 'Carrusel', icon: <LayoutGrid size={8} /> },
};

// ─── Recreation status strip ──────────────────────────────────────────────────

function RecreationStrip({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string }> = {
    pending:     { label: 'En preparacion', bg: 'rgba(0,0,0,0.72)' },
    preparacion: { label: 'Generando…',     bg: 'rgba(0,0,0,0.72)' },
    revisar:     { label: 'Lista · revisar', bg: '#7c3aed' },
    completed:   { label: 'Recreado',        bg: '#0D9488' },
    failed:      { label: 'Error',           bg: '#dc2626' },
  };
  const meta = map[status] ?? map.pending;
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: meta.bg, padding: '4px 8px',
      fontFamily: fc, fontSize: 9, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.07em', color: '#fff',
      textAlign: 'center',
    }}>
      {meta.label}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

interface Props {
  item:        InspirationItem;
  onFavorite?: (id: string, val: boolean) => void;
  onRequest?:  (item: InspirationItem) => void;
}

export function InspirationCard({ item, onFavorite, onRequest }: Props) {
  const [hover,    setHover]    = useState(false);
  const [favHover, setFavHover] = useState(false);
  const [sendHover, setSendHover] = useState(false);

  const typeKey = item.type?.toLowerCase() ?? '';
  const fmtMeta = FORMAT_META[typeKey];

  const title = item.title ?? 'Sin titulo';

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--bg)',
        border: `1px solid ${hover ? '#d1d5db' : 'var(--border)'}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: hover ? '0 4px 16px rgba(0,0,0,0.08)' : 'none',
      }}
    >
      {/* ── Thumbnail ──────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', aspectRatio: '4/5', background: '#0f172a', flexShrink: 0, overflow: 'hidden' }}>
        {item.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnail_url}
            alt={title}
            style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              transform: hover ? 'scale(1.03)' : 'scale(1)',
              transition: 'transform 0.3s ease',
            }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-1)', color: 'var(--text-tertiary)',
          }}>
            <ImageIcon size={28} />
          </div>
        )}

        {/* Gradient — always subtle, stronger at bottom for badges */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.0) 50%, rgba(0,0,0,0.55) 100%)',
          pointerEvents: 'none',
        }} />

        {/* Format badge — top left */}
        {fmtMeta && (
          <span style={{
            position: 'absolute', top: 7, left: 7,
            display: 'inline-flex', alignItems: 'center', gap: 3,
            background: 'rgba(0,0,0,0.50)', color: '#fff',
            padding: '3px 7px',
            fontFamily: fc, fontSize: 8, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            backdropFilter: 'blur(4px)',
          }}>
            {fmtMeta.icon} {fmtMeta.label}
          </span>
        )}

        {/* Heart + Send — top right, TikTok style: icons only, no background */}
        <div style={{
          position: 'absolute', top: 8, right: 8,
          display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center',
        }}>
          {/* Heart */}
          {onFavorite && (
            <button
              type="button"
              onClick={() => onFavorite(item.id, !item.is_favorite)}
              onMouseEnter={() => setFavHover(true)}
              onMouseLeave={() => setFavHover(false)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
                transform: favHover ? 'scale(1.18)' : 'scale(1)',
                transition: 'transform 0.12s',
              }}
              title={item.is_favorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
            >
              <Heart
                size={22}
                color={item.is_favorite || favHover ? '#D4537E' : '#fff'}
                fill={item.is_favorite ? '#D4537E' : 'none'}
                strokeWidth={item.is_favorite ? 0 : 1.8}
              />
            </button>
          )}

          {/* Send / Solicitar */}
          {onRequest && (
            <button
              type="button"
              onClick={() => onRequest(item)}
              onMouseEnter={() => setSendHover(true)}
              onMouseLeave={() => setSendHover(false)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
                transform: sendHover ? 'scale(1.18)' : 'scale(1)',
                transition: 'transform 0.12s',
              }}
              title="Solicitar a Neuropost"
            >
              <Send
                size={19}
                color={sendHover ? '#0D9488' : '#fff'}
                strokeWidth={1.8}
              />
            </button>
          )}
        </div>


        {/* Recreation status strip */}
        {item.recreation && <RecreationStrip status={item.recreation.status} />}
      </div>

    </div>
  );
}
