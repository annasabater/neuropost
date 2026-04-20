'use client';

// =============================================================================
// RecreationVersions — lightweight version selector for a recreation_request
// Renders a row of "vN" pills (one per entry in generation_history) plus a
// "Usar esta versión" button. Calls /api/inspiracion/recrear/[id]/use-version
// to swap generated_images without deleting history.
// =============================================================================

import { useState } from 'react';
import toast from 'react-hot-toast';

export interface HistoryEntry {
  prediction_id: string;
  images:        string[];
  generated_at:  string;
  version:       number;
}

interface Props {
  recreationId: string;
  history:      HistoryEntry[];
  activeImages: string[] | null | undefined;
  onApplied?:   (images: string[]) => void;
}

export function RecreationVersions({ recreationId, history, activeImages, onApplied }: Props) {
  const sorted = [...history].sort((a, b) => a.version - b.version);
  const activeKey = JSON.stringify(activeImages ?? []);
  const initial = sorted.find(h => JSON.stringify(h.images) === activeKey)?.version
               ?? sorted[sorted.length - 1]?.version
               ?? 1;

  const [selected, setSelected] = useState<number>(initial);
  const [saving,   setSaving]   = useState(false);

  if (sorted.length <= 1) return null;

  const entry = sorted.find(h => h.version === selected) ?? sorted[sorted.length - 1];
  const isActive = JSON.stringify(entry.images) === activeKey;

  async function handleUse() {
    setSaving(true);
    try {
      const res = await fetch(`/api/inspiracion/recrear/${recreationId}/use-version`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ version: selected }),
      });
      const data = await res.json() as { images?: string[]; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? 'No se pudo aplicar la versión');
        return;
      }
      toast.success(`Versión ${selected} aplicada`);
      onApplied?.(data.images ?? entry.images);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      display:      'flex',
      flexDirection: 'column',
      gap:           6,
      padding:       '8px 10px',
      background:    '#111',
      color:         '#fff',
      fontFamily:    'Barlow Condensed, sans-serif',
      fontSize:      11,
    }}>
      <div style={{ textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>
        Versiones ({sorted.length})
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {sorted.map(h => (
          <button
            key={h.version}
            onClick={() => setSelected(h.version)}
            style={{
              padding:       '4px 8px',
              background:    selected === h.version ? '#0D9488' : 'transparent',
              border:        '1px solid #333',
              color:         '#fff',
              fontFamily:    'inherit',
              fontSize:      11,
              fontWeight:    700,
              cursor:        'pointer',
            }}
          >
            v{h.version}
          </button>
        ))}
      </div>
      <button
        onClick={handleUse}
        disabled={saving || isActive}
        style={{
          padding:    '6px 10px',
          background: isActive ? '#333' : '#0D9488',
          color:      '#fff',
          border:     'none',
          fontFamily: 'inherit',
          fontSize:   11,
          fontWeight: 700,
          cursor:     isActive ? 'default' : 'pointer',
          opacity:    saving ? 0.6 : 1,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {isActive ? 'Versión activa' : (saving ? 'Aplicando…' : 'Usar esta versión')}
      </button>
    </div>
  );
}
