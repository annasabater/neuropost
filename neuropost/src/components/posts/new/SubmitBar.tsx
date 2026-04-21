'use client';

import { ArrowRight, Loader2 } from 'lucide-react';
import type { DeliveryMode } from './types';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

interface Props {
  deliveryMode:  DeliveryMode;
  submitting:    boolean;
  canSubmit:     boolean;
  completedSections: number;
  totalSections:     number;
  onSubmit:      () => void;
}

export function SubmitBar({
  deliveryMode, submitting, canSubmit, completedSections, totalSections, onSubmit,
}: Props) {
  const pct = Math.round((completedSections / totalSections) * 100);

  return (
    <div style={{
      position: 'sticky', bottom: 0, zIndex: 40,
      background: 'var(--bg)', borderTop: '2px solid var(--border)',
      padding: '16px 24px',
      display: 'flex', alignItems: 'center', gap: 20,
    }}>
      {/* Progress */}
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: f, fontSize: 11, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.1em',
          color: 'var(--text-secondary)', marginBottom: 6,
        }}>
          {completedSections}/{totalSections} secciones completadas
        </div>
        <div style={{ height: 3, background: 'var(--border)', position: 'relative' }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${pct}%`, background: '#0F766E',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* CTA */}
      <button
        type="button"
        disabled={!canSubmit || submitting}
        onClick={onSubmit}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 24px',
          background: canSubmit && !submitting ? '#111827' : 'var(--border)',
          color: canSubmit && !submitting ? '#fff' : 'var(--text-secondary)',
          border: 'none', cursor: canSubmit && !submitting ? 'pointer' : 'not-allowed',
          fontFamily: fc, fontWeight: 900, fontSize: 14,
          textTransform: 'uppercase', letterSpacing: '0.06em',
          flexShrink: 0,
        }}
      >
        {submitting ? (
          <>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            Enviando…
          </>
        ) : (
          <>
            {deliveryMode === 'instant' ? 'Generar ahora' : 'Enviar solicitud'}
            <ArrowRight size={16} />
          </>
        )}
      </button>
    </div>
  );
}
