'use client';

import { SUBTYPES, type PostObjective } from './types';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

interface Props {
  objective: PostObjective | null;
  value:     string | null;
  onChange:  (v: string, placeholder: string) => void;
}

export function Section3SubType({ objective, value, onChange }: Props) {
  if (!objective) return null;

  const options = SUBTYPES[objective];

  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{
          fontFamily: fc, fontWeight: 900, fontSize: 22,
          textTransform: 'uppercase', letterSpacing: '0.02em',
          color: 'var(--text-primary)', marginBottom: 4,
        }}>
          3 — Tipo de contenido
        </h2>
        <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-secondary)' }}>
          Elige el formato específico dentro del objetivo.
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)' }}>
        {options.map((opt) => {
          const active = value === opt.v;
          return (
            <button
              key={opt.v}
              type="button"
              onClick={() => onChange(opt.v, opt.placeholder)}
              style={{
                padding: '10px 16px', cursor: 'pointer', border: 'none', outline: 'none',
                background: active ? '#111827' : 'var(--bg)',
                fontFamily: f, fontSize: 13, fontWeight: active ? 700 : 400,
                color: active ? '#fff' : 'var(--text-primary)',
                whiteSpace: 'nowrap',
              }}
            >
              {opt.l}
            </button>
          );
        })}
      </div>
    </section>
  );
}
