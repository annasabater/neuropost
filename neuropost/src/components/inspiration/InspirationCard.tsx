'use client';

import { useState } from 'react';
import {
  Heart, ImageIcon, Film, LayoutGrid, Video, Send, Bookmark, Play,
} from 'lucide-react';
import { RecreationVersions } from './RecreationVersions';

const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

// ─── Types ────────────────────────────────────────────────────────────────────

export type InspirationOrigin = 'editorial' | 'user_saved' | 'ai_generated' | 'bank';
export type InspirationSource = 'legacy' | 'bank';

export type InspirationItem = {
  id:                string;
  /** When absent, legacy-only callers can omit; we default to 'legacy'. */
  source?:           InspirationSource;
  type?:             string;
  media_type?:       'image' | 'carousel' | 'video';
  media_urls?:       string[];
  video_frames_urls?: string[];
  source_url:        string | null;
  thumbnail_url:     string | null;
  title:             string | null;
  notes:             string | null;
  style_tags:        string[] | null;
  tags:              string[];
  format:            string | null;
  is_favorite:       boolean;
  /** New unified flags — optional for back-compat with legacy callers. */
  is_saved?:            boolean;
  saved_collection_ids?: string[];
  classified_at:     string | null;
  usage_count:       number;
  description_short: string | null;
  reusability_score: number | null;
  origin:            InspirationOrigin | null;
  source_handle:     string | null;
  dominant_colors?:  string[] | null;
  mood?:             string | null;
  /** Bank category (e.g. 'cafeteria'). Not present on legacy rows. */
  category?:         string | null;
  created_at:        string;
  /** Set when the item has a pending/in_progress reference_request. */
  has_active_request?: boolean;
  recreation?: {
    id: string;
    status: string;
    generated_images?: string[] | null;
    generation_history?: {
      prediction_id: string;
      images:        string[];
      generated_at:  string;
      version:       number;
    }[] | null;
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

function resolveFormatMeta(item: InspirationItem) {
  // Prefer unified media_type (from bank + view) then legacy type/format
  const key = (item.media_type ?? item.type ?? item.format ?? '').toLowerCase();
  return FORMAT_META[key];
}

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
  onFavorite?: (id: string, val: boolean, item: InspirationItem) => void;
  onSave?:     (item: InspirationItem, anchor: DOMRect) => void;
  onRequest?:  (item: InspirationItem) => void;
  /** When provided, the card is clickable and opens the fullscreen viewer. */
  onOpen?:     (item: InspirationItem) => void;
}

export function InspirationCard({ item, onFavorite, onSave, onRequest, onOpen }: Props) {
  const [hover,      setHover]      = useState(false);
  const [favHover,   setFavHover]   = useState(false);
  const [saveHover,  setSaveHover]  = useState(false);
  const [sendHover,  setSendHover]  = useState(false);

  const fmtMeta  = resolveFormatMeta(item);
  const title    = item.title ?? 'Sin titulo';
  const slides   = item.media_urls ?? [];
  const isVideo    = item.media_type === 'video';
  const isCarousel = item.media_type === 'carousel' && slides.length > 1;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={(e) => {
        // Don't hijack clicks on inner buttons
        if ((e.target as HTMLElement).closest('button')) return;
        onOpen?.(item);
      }}
      style={{
        background: 'var(--bg)',
        border: `1px solid ${hover ? '#d1d5db' : 'var(--border)'}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: hover ? '0 4px 16px rgba(0,0,0,0.08)' : 'none',
        cursor: onOpen ? 'pointer' : 'default',
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

        {/* Gradient */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.0) 50%, rgba(0,0,0,0.55) 100%)',
          pointerEvents: 'none',
        }} />

        {/* Hover overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.22)',
          opacity: hover ? 1 : 0,
          transition: 'opacity 0.2s ease',
          pointerEvents: 'none',
        }} />

        {/* Carousel slide counter — top left */}
        {isCarousel && (
          <span style={{
            position: 'absolute', top: 7, left: 7,
            background: 'rgba(0,0,0,0.55)', color: '#fff',
            padding: '3px 7px',
            fontFamily: fc, fontSize: 8, fontWeight: 700,
            letterSpacing: '0.06em',
          }}>
            1/{slides.length}
          </span>
        )}

        {/* Video play chip — center */}
        {isVideo && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'rgba(0,0,0,0.55)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Play size={22} color="#fff" fill="#fff" strokeWidth={0} />
            </div>
          </div>
        )}

        {/* Heart + Bookmark + Send — top right */}
        <div
          className="insp-actions"
          style={{
            position: 'absolute', top: 8, right: 8,
            display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center',
          }}
        >
          {onFavorite && (
            <button
              type="button"
              onClick={() => onFavorite(item.id, !item.is_favorite, item)}
              onMouseEnter={() => setFavHover(true)}
              onMouseLeave={() => setFavHover(false)}
              aria-label={item.is_favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
              title={item.is_favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
                transform: favHover ? 'scale(1.18)' : 'scale(1)',
                transition: 'transform 0.12s',
              }}
            >
              <Heart
                size={22}
                color={item.is_favorite || favHover ? '#D4537E' : '#fff'}
                fill={item.is_favorite ? '#D4537E' : 'none'}
                strokeWidth={item.is_favorite ? 0 : 1.8}
              />
            </button>
          )}

          {onSave && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                onSave(item, rect);
              }}
              onMouseEnter={() => setSaveHover(true)}
              onMouseLeave={() => setSaveHover(false)}
              aria-label={item.is_saved ? 'Editar guardado' : 'Guardar referencia'}
              title={item.is_saved ? 'Editar guardado' : 'Guardar referencia'}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
                transform: saveHover ? 'scale(1.18)' : 'scale(1)',
                transition: 'transform 0.12s',
              }}
            >
              <Bookmark
                size={20}
                color={item.is_saved || saveHover ? '#0F766E' : '#fff'}
                fill={item.is_saved ? '#0F766E' : 'none'}
                strokeWidth={item.is_saved ? 0 : 1.8}
              />
            </button>
          )}

          {onRequest && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRequest(item); }}
              onMouseEnter={() => setSendHover(true)}
              onMouseLeave={() => setSendHover(false)}
              aria-label="Enviar solicitud de recreación"
              title="Enviar solicitud"
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
                transform: sendHover ? 'scale(1.18)' : 'scale(1)',
                transition: 'transform 0.12s',
              }}
            >
              <Send size={19} color={sendHover ? '#0D9488' : '#fff'} strokeWidth={1.8} />
            </button>
          )}
        </div>

        {/* Recreation status strip */}
        {item.recreation && <RecreationStrip status={item.recreation.status} />}
      </div>

      {/* Version selector — only when client has >1 generated versions */}
      {item.recreation?.generation_history && item.recreation.generation_history.length > 1 && (
        <RecreationVersions
          recreationId={item.recreation.id}
          history={item.recreation.generation_history}
          activeImages={item.recreation.generated_images}
        />
      )}

      <style>{`
        @media (max-width: 767px) {
          .insp-actions { opacity: 1 !important; }
        }
      `}</style>
    </div>
  );
}
