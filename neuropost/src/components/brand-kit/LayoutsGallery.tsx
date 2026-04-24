'use client';

// =============================================================================
// LayoutsGallery — Phase 2.C
// =============================================================================
// Client-side grid that loads a preview PNG per layout from
// /api/brand/preview-layout/[layoutId]?brand_id=... .
// Layouts are sorted by tonality so the eye travels photo-heavy → balanced →
// text-heavy. Each card has a retry affordance if its preview fails.
// =============================================================================

import { useState } from 'react';
import { LAYOUT_CATALOG, type LayoutDefinition, type Tonality } from '@/lib/stories/layouts-catalog';

interface Props {
  brandId: string;
}

const TONALITY_ORDER: Record<Tonality, number> = {
  photo_heavy: 0,
  balanced:    1,
  text_heavy:  2,
};

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

function previewUrl(brandId: string, layoutId: string, bust?: number): string {
  const base = `/api/brand/preview-layout/${encodeURIComponent(layoutId)}?brand_id=${encodeURIComponent(brandId)}`;
  return bust ? `${base}&t=${bust}` : base;
}

function textModeLabel(mode: LayoutDefinition['text_mode']): { label: string; color: string } {
  switch (mode) {
    case 'required': return { label: 'Texto',          color: '#111827' };
    case 'optional': return { label: 'Texto opcional', color: '#6b7280' };
    case 'none':     return { label: 'Sin texto',      color: '#9ca3af' };
  }
}

function LayoutCard({ brandId, layout }: { brandId: string; layout: LayoutDefinition }) {
  const [bust,    setBust]    = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  const tm = textModeLabel(layout.text_mode);
  const visibleAffinities = layout.aesthetic_affinity.slice(0, 3);
  const extraAffinities   = Math.max(0, layout.aesthetic_affinity.length - visibleAffinities.length);

  const handleRetry = () => {
    setErrored(false);
    setLoading(true);
    setBust(Date.now());
  };

  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      gap:            12,
      background:     '#ffffff',
      border:         '1px solid #e5e7eb',
      borderRadius:   12,
      overflow:       'hidden',
    }}>
      {/* Preview image */}
      <div style={{
        position:        'relative',
        width:           '100%',
        aspectRatio:     '9 / 16',
        background:      '#f3f4f6',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
      }}>
        {!errored && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl(brandId, layout.id, bust)}
            alt={`Preview ${layout.name}`}
            loading="lazy"
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setErrored(true); }}
            style={{
              width:      '100%',
              height:     '100%',
              objectFit:  'cover',
              opacity:    loading ? 0 : 1,
              transition: 'opacity 180ms ease',
            }}
          />
        )}
        {loading && !errored && (
          <div style={{
            position:       'absolute',
            inset:          0,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            background:     'linear-gradient(90deg, #f3f4f6 0%, #e5e7eb 50%, #f3f4f6 100%)',
            backgroundSize: '200% 100%',
            animation:      'layouts-gallery-pulse 1.2s ease-in-out infinite',
            color:          '#9ca3af',
            fontFamily:     f,
            fontSize:       13,
          }}>
            Generando preview…
          </div>
        )}
        {errored && (
          <div style={{
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            12,
            padding:        16,
            color:          '#6b7280',
            textAlign:      'center',
            fontFamily:     f,
          }}>
            <div style={{ fontSize: 28 }}>⚠️</div>
            <div style={{ fontSize: 13 }}>Error al generar preview</div>
            <button
              type="button"
              onClick={handleRetry}
              style={{
                padding:      '6px 14px',
                fontSize:     12,
                fontFamily:   f,
                fontWeight:   600,
                color:        '#111827',
                background:   '#ffffff',
                border:       '1px solid #d1d5db',
                borderRadius: 6,
                cursor:       'pointer',
              }}
            >
              Reintentar
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 14px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontFamily: fc, fontSize: 18, fontWeight: 700, color: '#111827', letterSpacing: '-0.01em' }}>
            {layout.name}
          </div>
          <div style={{
            fontFamily:     f,
            fontSize:       10,
            fontWeight:     700,
            letterSpacing:  '0.08em',
            textTransform:  'uppercase',
            color:          tm.color,
            border:         `1px solid ${tm.color === '#9ca3af' ? '#e5e7eb' : '#d1d5db'}`,
            padding:        '2px 6px',
            borderRadius:   4,
            whiteSpace:     'nowrap',
          }}>
            {tm.label}
          </div>
        </div>

        <div style={{ fontFamily: f, fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>
          {layout.description}
        </div>

        {/* Badges row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
          {layout.requiresImage && (
            <span style={{
              fontFamily: f, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: '#0f766e', background: '#ccfbf1',
              padding: '3px 8px', borderRadius: 999,
            }}>
              Requiere foto
            </span>
          )}
          {!layout.requiresImage && layout.supportsImage && (
            <span style={{
              fontFamily: f, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: '#3730a3', background: '#e0e7ff',
              padding: '3px 8px', borderRadius: 999,
            }}>
              Acepta foto
            </span>
          )}
          {visibleAffinities.map(a => (
            <span key={a} style={{
              fontFamily: f, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: '#374151', background: '#f3f4f6',
              padding: '3px 8px', borderRadius: 999,
            }}>
              {a}
            </span>
          ))}
          {extraAffinities > 0 && (
            <span style={{
              fontFamily: f, fontSize: 10, fontWeight: 700, color: '#6b7280',
              padding: '3px 8px',
            }}>
              +{extraAffinities}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function LayoutsGallery({ brandId }: Props) {
  const sorted = [...LAYOUT_CATALOG].sort((a, b) => {
    const d = TONALITY_ORDER[a.tonality] - TONALITY_ORDER[b.tonality];
    return d !== 0 ? d : a.name.localeCompare(b.name);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        @keyframes layouts-gallery-pulse {
          0%   { background-position:   0% 0%; }
          100% { background-position: 200% 0%; }
        }
        @media (min-width: 720px)  { .layouts-gallery-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (min-width: 1080px) { .layouts-gallery-grid { grid-template-columns: repeat(3, 1fr) !important; } }
      `}</style>
      <div
        className="layouts-gallery-grid"
        style={{
          display:             'grid',
          gridTemplateColumns: '1fr',
          gap:                 16,
        }}
      >
        {sorted.map(layout => (
          <LayoutCard key={layout.id} brandId={brandId} layout={layout} />
        ))}
      </div>
    </div>
  );
}
