'use client';

import Link from 'next/link';
import type { Brand } from '@/types';
import { labelVisualStyle } from '@/lib/brand/labels';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

interface Props {
  brand: Brand;
}

interface SwatchProps {
  color: string | null | undefined;
}

function ColorSwatch({ color }: SwatchProps) {
  if (!color) {
    return (
      <span style={{
        display:     'inline-block',
        width:       16,
        height:      16,
        border:      '1.5px dashed #d4d4d8',
        borderRadius: 0,
      }} />
    );
  }
  return (
    <span style={{
      display:      'inline-block',
      width:        16,
      height:       16,
      background:   color,
      border:       '1px solid rgba(0,0,0,0.08)',
      borderRadius: 0,
    }} />
  );
}

export function IdentityCard({ brand }: Props) {
  const city = brand.location?.split(',')[0] ?? null;

  return (
    <div style={{
      background:    '#fff',
      border:        '1px solid #d4d4d8',
      borderRadius:  0,
      padding:       16,
      display:       'flex',
      flexDirection: 'column',
      gap:           10,
      height:        '100%',
      boxSizing:     'border-box',
    }}>
      {/* Section label */}
      <p style={{
        fontFamily:    f,
        fontSize:      10,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color:         '#6b7280',
        margin:        0,
        fontWeight:    600,
      }}>
        Identidad
      </p>

      {/* Business name */}
      <p style={{
        fontFamily: f,
        fontSize:   14,
        fontWeight: 700,
        color:      '#111827',
        margin:     0,
      }}>
        {brand.name}
      </p>

      {/* Sector + city */}
      {(brand.sector || city) && (
        <p style={{
          fontFamily: f,
          fontSize:   12,
          color:      '#6b7280',
          margin:     0,
        }}>
          {[brand.sector, city].filter(Boolean).join(' · ')}
        </p>
      )}

      {/* Color swatches */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <ColorSwatch color={brand.colors?.primary} />
        <ColorSwatch color={brand.colors?.secondary} />
        <ColorSwatch color={brand.colors?.accent} />
      </div>

      {/* Visual style badge */}
      {brand.visual_style && (
        <span style={{
          display:       'inline-block',
          fontFamily:    f,
          fontSize:      11,
          border:        '1px solid #111827',
          borderRadius:  0,
          padding:       '2px 8px',
          color:         '#111827',
          alignSelf:     'flex-start',
        }}>
          Estilo {labelVisualStyle(brand.visual_style)}
        </span>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Edit link */}
      <Link
        href="/brand-kit?edit=basics"
        style={{
          fontFamily:     f,
          fontSize:       12,
          color:          '#0F766E',
          textDecoration: 'none',
          fontWeight:     600,
        }}
      >
        {brand.visual_style || brand.colors ? 'Editar →' : 'Configurar →'}
      </Link>
    </div>
  );
}
