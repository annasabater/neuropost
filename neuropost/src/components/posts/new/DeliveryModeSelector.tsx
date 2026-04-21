'use client';

import { Zap, Clock } from 'lucide-react';
import type { DeliveryMode } from './types';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

interface Props {
  value:        DeliveryMode;
  canInstant:   boolean;
  onChange:     (v: DeliveryMode) => void;
}

const OPTIONS: {
  v:     DeliveryMode;
  label: string;
  desc:  string;
  icon:  typeof Zap;
}[] = [
  {
    v:     'reviewed',
    label: 'Con revisión',
    desc:  'Un especialista revisa el resultado antes de que lo veas. Mayor calidad garantizada.',
    icon:  Clock,
  },
  {
    v:     'instant',
    label: 'Instantáneo',
    desc:  'Resultado inmediato generado por IA. Disponible para plan Pro y superior.',
    icon:  Zap,
  },
];

export function DeliveryModeSelector({ value, canInstant, onChange }: Props) {
  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{
          fontFamily: fc, fontWeight: 900, fontSize: 22,
          textTransform: 'uppercase', letterSpacing: '0.02em',
          color: 'var(--text-primary)', marginBottom: 4,
        }}>
          Modo de entrega
        </h2>
        <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-secondary)' }}>
          ¿Cómo quieres recibir el resultado?
        </p>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: '1px', background: 'var(--border)', border: '1px solid var(--border)',
      }}>
        {OPTIONS.map((opt) => {
          const disabled = opt.v === 'instant' && !canInstant;
          const active   = value === opt.v && !disabled;
          const Icon     = opt.icon;
          return (
            <button
              key={opt.v}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onChange(opt.v)}
              style={{
                padding: '20px 16px', textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer',
                background: active ? '#0F766E' : 'var(--bg)',
                border: 'none', outline: 'none', opacity: disabled ? 0.4 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <Icon size={18} color={active ? '#fff' : '#0F766E'} />
                <span style={{
                  fontFamily: fc, fontWeight: 900, fontSize: 16,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  color: active ? '#fff' : 'var(--text-primary)',
                }}>
                  {opt.label}
                </span>
              </div>
              <div style={{
                fontFamily: f, fontSize: 12,
                color: active ? 'rgba(255,255,255,0.85)' : 'var(--text-secondary)',
                lineHeight: 1.5,
              }}>
                {opt.desc}
                {disabled && <span style={{ display: 'block', marginTop: 4, color: '#ef4444', fontSize: 11 }}>
                  Requiere plan Pro o superior
                </span>}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
