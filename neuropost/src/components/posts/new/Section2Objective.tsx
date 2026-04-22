'use client';

import { OBJECTIVES, SUBTYPES, type PostObjective } from './types';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

interface Props {
  value:       PostObjective | null;
  onChange:    (v: PostObjective) => void;
  subtype:     string | null;
  onSubtype:   (v: string, placeholder: string) => void;
}

export function Section2Objective({ value, onChange, subtype, onSubtype }: Props) {
  const subtypeOptions = value ? SUBTYPES[value] : [];

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
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
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

      {value && subtypeOptions.length > 0 && (
        <div style={{ marginTop: 12, borderLeft: '3px solid #0F766E', paddingLeft: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
            <span style={{ fontFamily: fc, fontWeight: 900, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#0F766E' }}>
              Tipo de contenido
            </span>
            <span style={{ fontFamily: f, fontSize: 11, color: 'var(--text-secondary)' }}>opcional</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {subtype !== null && (
              <button
                type="button"
                onClick={() => onSubtype('', '')}
                style={{
                  padding: '6px 12px', cursor: 'pointer', border: '1px dashed #9ca3af',
                  background: 'transparent', fontFamily: f, fontSize: 12,
                  color: 'var(--text-secondary)', whiteSpace: 'nowrap',
                }}
              >
                ✕ quitar
              </button>
            )}
            {subtypeOptions.map((opt) => {
              const active = subtype === opt.v;
              return (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => onSubtype(opt.v, opt.placeholder)}
                  style={{
                    padding: '6px 14px', cursor: 'pointer',
                    border: active ? '1px solid #0F766E' : '1px solid var(--border)',
                    background: active ? '#0F766E' : 'var(--bg)',
                    fontFamily: f, fontSize: 13, fontWeight: active ? 700 : 400,
                    color: active ? '#fff' : 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    transition: 'all .12s ease',
                  }}
                >
                  {opt.l}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
