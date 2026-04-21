'use client';

import { useState } from 'react';
import { ToggleLeft, ToggleRight } from 'lucide-react';
import { WORKER_FONT as f, WORKER_FONT_CONDENSED as fc } from './theme';
import type { PostRevision } from './cockpit-types';

type Props = {
  revision: PostRevision | null;
  originalImageUrl?: string | null;
};

export function CurrentResultPanel({ revision, originalImageUrl }: Props) {
  const [compare, setCompare] = useState(false);

  if (!revision) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: 300, border: '1px dashed #e5e7eb', color: '#9ca3af', fontFamily: f, fontSize: 13,
      }}>
        Sin resultado todavía — selecciona una revisión o genera una nueva
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Metadata */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{
          background: '#f3f4f6', border: '1px solid #e5e7eb',
          padding: '3px 8px', fontSize: 11, fontFamily: fc, fontWeight: 700,
          letterSpacing: '0.04em', color: '#374151', textTransform: 'uppercase' as const,
        }}>
          REV #{revision.revision_index}
        </span>
        {revision.model && (
          <span style={{
            background: '#ecfdf5', border: '1px solid #a7f3d0',
            padding: '3px 8px', fontSize: 11, fontFamily: fc, fontWeight: 700,
            letterSpacing: '0.04em', color: '#065f46', textTransform: 'uppercase' as const,
          }}>
            {revision.model}
          </span>
        )}
        {revision.triggered_by && (
          <span style={{
            background: '#eff6ff', border: '1px solid #bfdbfe',
            padding: '3px 8px', fontSize: 11, fontFamily: fc, fontWeight: 700,
            letterSpacing: '0.04em', color: '#1d4ed8', textTransform: 'uppercase' as const,
          }}>
            {revision.triggered_by}
          </span>
        )}
        <span style={{ fontSize: 11, fontFamily: f, color: '#6b7280', marginLeft: 'auto' }}>
          {revision.cost_usd != null ? `$${revision.cost_usd.toFixed(3)}` : ''}
          {revision.duration_seconds != null ? ` · ${revision.duration_seconds}s` : ''}
        </span>
      </div>

      {/* Compare toggle */}
      {revision.image_url && originalImageUrl && (
        <button
          onClick={() => setCompare(!compare)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'none', border: '1px solid #e5e7eb',
            padding: '6px 12px', cursor: 'pointer',
            color: compare ? '#0F766E' : '#6b7280',
            fontSize: 12, fontFamily: f, fontWeight: 600, alignSelf: 'flex-start',
          }}
        >
          {compare ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
          Comparar con original
        </button>
      )}

      {/* Image display */}
      {revision.image_url ? (
        compare && originalImageUrl ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', fontFamily: fc, letterSpacing: '0.06em', marginBottom: 4, textTransform: 'uppercase' as const }}>
                ORIGINAL
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={originalImageUrl} alt="original" style={{ width: '100%', display: 'block', objectFit: 'cover', border: '1px solid #e5e7eb' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#0F766E', fontFamily: fc, letterSpacing: '0.06em', marginBottom: 4, textTransform: 'uppercase' as const }}>
                REVISIÓN #{revision.revision_index}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={revision.image_url} alt="resultado" style={{ width: '100%', display: 'block', objectFit: 'cover', border: '2px solid #0D9488' }} />
            </div>
          </div>
        ) : (
          <div style={{ border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={revision.image_url} alt="resultado" style={{ width: '100%', display: 'block', objectFit: 'contain', maxHeight: 420 }} />
          </div>
        )
      ) : (
        <div style={{
          height: 200, border: '1px dashed #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#9ca3af', fontSize: 13, fontFamily: f,
        }}>
          Generando imagen…
        </div>
      )}

      {/* Timestamp */}
      <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: f }}>
        {new Date(revision.created_at).toLocaleString('es-ES')}
      </div>
    </div>
  );
}
