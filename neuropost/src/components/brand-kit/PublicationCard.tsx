'use client';

import Link from 'next/link';
import type { Brand } from '@/types';
import { labelPublishMode } from '@/lib/brand/labels';

const f = "var(--font-barlow), 'Barlow', sans-serif";

interface Props {
  brand:              Brand;
  contentRulesCount:  number;
}

export function PublicationCard({ brand, contentRulesCount }: Props) {
  const postsPerWeek = brand.rules?.preferences?.postsPerWeek;

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
        Publicación
      </p>

      {/* Publish mode */}
      <p style={{
        fontFamily: f,
        fontSize:   14,
        fontWeight: 700,
        color:      '#111827',
        margin:     0,
      }}>
        {labelPublishMode(brand.publish_mode)}
      </p>

      {/* Frequency */}
      {postsPerWeek !== undefined && postsPerWeek > 0 && (
        <p style={{
          fontFamily: f,
          fontSize:   12,
          color:      '#6b7280',
          margin:     0,
        }}>
          {postsPerWeek} posts/sem
        </p>
      )}

      {/* Content rules */}
      {contentRulesCount === 0 ? (
        <p style={{
          fontFamily: f,
          fontSize:   12,
          color:      '#d97706',
          margin:     0,
          display:    'flex',
          alignItems: 'center',
          gap:        4,
        }}>
          <span>⚠</span> Sin reglas definidas
        </p>
      ) : (
        <p style={{
          fontFamily: f,
          fontSize:   12,
          color:      '#6b7280',
          margin:     0,
        }}>
          {contentRulesCount} {contentRulesCount === 1 ? 'categoría activa' : 'categorías activas'}
        </p>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Edit link */}
      <Link
        href="/brand-kit?edit=publish"
        style={{
          fontFamily:     f,
          fontSize:       12,
          color:          '#0F766E',
          textDecoration: 'none',
          fontWeight:     600,
        }}
      >
        Editar →
      </Link>
    </div>
  );
}
