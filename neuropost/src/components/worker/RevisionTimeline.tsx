'use client';

import { WORKER_FONT as f, WORKER_FONT_CONDENSED as fc } from './theme';
import type { PostRevision } from './cockpit-types';

type Props = {
  revisions: PostRevision[];
  selectedId: string | null;
  onSelect: (revision: PostRevision) => void;
};

const TRIGGER_COLORS: Record<string, string> = {
  worker: '#0F766E',
  agent:  '#3b82f6',
  client: '#f59e0b',
};

export function RevisionTimeline({ revisions, selectedId, onSelect }: Props) {
  if (revisions.length === 0) {
    return (
      <div style={{
        padding: '10px 14px',
        fontSize: 12, color: '#9ca3af', fontFamily: f,
        border: '1px solid #e5e7eb', background: '#f9fafb',
      }}>
        Sin revisiones — genera la primera
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <div style={{ display: 'flex', gap: 8, minWidth: 'max-content' }}>
        {revisions.map((rev) => {
          const isSelected = rev.id === selectedId;
          const triggerColor = TRIGGER_COLORS[rev.triggered_by ?? 'agent'] ?? '#6b7280';

          return (
            <button
              key={rev.id}
              onClick={() => onSelect(rev)}
              title={`Rev #${rev.revision_index} · ${rev.model ?? '?'} · ${rev.triggered_by ?? 'agent'}`}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                background: isSelected ? '#f0fdf9' : 'none',
                border: isSelected ? `2px solid #0F766E` : '2px solid transparent',
                padding: 6, cursor: 'pointer', position: 'relative', flexShrink: 0,
              }}
            >
              {/* Thumbnail */}
              <div style={{
                width: 72, height: 72, overflow: 'hidden',
                border: isSelected ? '2px solid #0F766E' : '1px solid #e5e7eb',
                background: '#f3f4f6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {rev.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={rev.image_url}
                    alt={`rev-${rev.revision_index}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <span style={{ fontSize: 18, color: '#d1d5db' }}>⌛</span>
                )}
              </div>

              {/* Index + model */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: isSelected ? '#0F766E' : '#374151',
                  fontFamily: fc, letterSpacing: '0.04em',
                }}>
                  #{rev.revision_index}
                </span>
                <span style={{
                  fontSize: 9, color: '#6b7280', fontFamily: f,
                  maxWidth: 76, textAlign: 'center' as const,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                }}>
                  {(rev.model ?? '—').replace('flux-', '')}
                </span>
              </div>

              {/* Trigger dot */}
              <div style={{
                position: 'absolute', top: 4, right: 4,
                width: 7, height: 7, borderRadius: '50%',
                background: triggerColor,
              }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
