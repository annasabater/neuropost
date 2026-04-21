'use client';

import { OBJECTIVES, type PostObjective } from './types';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

interface Props {
  value:    PostObjective | null;
  onChange: (v: PostObjective) => void;
}

export function Section2Objective({ value, onChange }: Props) {
  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{
          fontFamily: fc, fontWeight: 900, fontSize: 22,
          textTransform: 'uppercase', letterSpacing: '0.02em',
          color: 'var(--text-primary)', marginBottom: 4,
        }}>
          2 — Objetivo del post
        </h2>
        <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-secondary)' }}>
          ¿Qué quieres conseguir con esta publicación?
        </p>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: '1px', background: 'var(--border)', border: '1px solid var(--border)',
      }}>
        {OBJECTIVES.map((obj) => {
          const active = value === obj.v;
          return (
            <button
              key={obj.v}
              type="button"
              onClick={() => onChange(obj.v)}
              style={{
                padding: '16px 14px', textAlign: 'left', cursor: 'pointer',
                background: active ? '#111827' : 'var(--bg)',
                border: 'none', outline: 'none',
              }}
            >
              <div style={{
                fontFamily: fc, fontWeight: 900, fontSize: 15,
                textTransform: 'uppercase', letterSpacing: '0.04em',
                color: active ? '#fff' : 'var(--text-primary)', marginBottom: 4,
              }}>
                {obj.l}
              </div>
              <div style={{
                fontFamily: f, fontSize: 11,
                color: active ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)',
                lineHeight: 1.4,
              }}>
                {obj.desc}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
