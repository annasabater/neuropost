'use client';

import { useState } from 'react';
import { History, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import type { PostVersion } from '@/types';

interface Props {
  versions:  PostVersion[];
  onRevert?: (version: PostVersion) => Promise<void>;
}

export function VersionsPanel({ versions, onRevert }: Props) {
  const [open,       setOpen]       = useState(false);
  const [reverting,  setReverting]  = useState<number | null>(null);
  const [expanded,   setExpanded]   = useState<number | null>(null);

  if (!versions || versions.length === 0) return null;

  async function handleRevert(v: PostVersion, idx: number) {
    if (!onRevert) return;
    setReverting(idx);
    try {
      await onRevert(v);
    } finally {
      setReverting(null);
    }
  }

  return (
    <div className="settings-section" style={{ marginTop: 0 }}>
      <button
        style={{
          display:        'flex',
          alignItems:     'center',
          gap:            8,
          background:     'none',
          border:         'none',
          cursor:         'pointer',
          padding:        0,
          fontFamily:     "'Cabinet Grotesk', sans-serif",
          fontWeight:     700,
          fontSize:       '0.88rem',
          color:          'var(--ink)',
          width:          '100%',
          justifyContent: 'space-between',
        }}
        onClick={() => setOpen((v) => !v)}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <History size={16} color="var(--muted)" />
          Historial de versiones
          <span style={{
            padding:      '2px 8px',
            borderRadius: 20,
            background:   'var(--surface)',
            border:       '1px solid var(--border)',
            fontSize:     '0.72rem',
            color:        'var(--muted)',
            fontWeight:   600,
          }}>
            {versions.length}
          </span>
        </span>
        {open ? <ChevronUp size={16} color="var(--muted)" /> : <ChevronDown size={16} color="var(--muted)" />}
      </button>

      {open && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...versions].reverse().map((v, i) => {
            const origIdx = versions.length - 1 - i;
            const isExpanded = expanded === origIdx;
            return (
              <div
                key={origIdx}
                style={{
                  padding:      '10px 12px',
                  borderRadius: 8,
                  border:       '1px solid var(--border)',
                  background:   'var(--surface)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 2 }}>
                      Versión {versions.length - i}
                      <span style={{ fontWeight: 400, marginLeft: 8 }}>
                        {new Date(v.savedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </p>
                    <p
                      style={{
                        fontSize:   '0.82rem',
                        color:      'var(--ink)',
                        lineHeight: 1.4,
                        maxHeight:  isExpanded ? 'none' : 40,
                        overflow:   'hidden',
                        cursor:     'pointer',
                      }}
                      onClick={() => setExpanded(isExpanded ? null : origIdx)}
                    >
                      {v.caption}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      style={{
                        padding:      '4px 10px',
                        borderRadius: 6,
                        border:       '1px solid var(--border)',
                        background:   'white',
                        fontSize:     '0.75rem',
                        cursor:       'pointer',
                        color:        'var(--muted)',
                      }}
                      onClick={() => setExpanded(isExpanded ? null : origIdx)}
                    >
                      {isExpanded ? 'Ocultar' : 'Ver'}
                    </button>
                    {onRevert && (
                      <button
                        disabled={reverting === origIdx}
                        onClick={() => handleRevert(v, origIdx)}
                        title="Restaurar esta versión como caption actual"
                        style={{
                          display:      'flex',
                          alignItems:   'center',
                          gap:          4,
                          padding:      '4px 10px',
                          borderRadius: 6,
                          border:       '1px solid var(--orange)',
                          background:   'var(--orange-light)',
                          fontSize:     '0.75rem',
                          cursor:       'pointer',
                          color:        'var(--orange)',
                          fontWeight:   600,
                          fontFamily:   "'Cabinet Grotesk', sans-serif",
                        }}
                      >
                        <RotateCcw size={12} />
                        {reverting === origIdx ? 'Restaurando…' : 'Restaurar'}
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && v.hashtags.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {v.hashtags.map((h) => (
                      <span key={h} className="tag-chip" style={{ fontSize: '0.72rem' }}>#{h.replace(/^#/, '')}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}