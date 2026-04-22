'use client';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

interface Props {
  value:       string;
  placeholder: string;
  onChange:    (v: string) => void;
}

export function Section4Description({ value, placeholder, onChange }: Props) {
  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{
          fontFamily: fc, fontWeight: 900, fontSize: 22,
          textTransform: 'uppercase', letterSpacing: '0.02em',
          color: 'var(--text-primary)', marginBottom: 4,
        }}>
          3 — Descripción
        </h2>
        <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-secondary)' }}>
          Cuéntanos qué quieres publicar con el máximo detalle posible.
        </p>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={5}
        style={{
          width: '100%', boxSizing: 'border-box',
          border: '1px solid var(--border)', padding: '12px 14px',
          fontFamily: f, fontSize: 14, lineHeight: 1.6,
          background: 'var(--bg)', color: 'var(--text-primary)',
          resize: 'vertical', outline: 'none',
          borderRadius: 0,
        }}
      />
      <div style={{
        display: 'flex', justifyContent: 'flex-end',
        fontFamily: f, fontSize: 11, color: value.length > 800 ? '#ef4444' : 'var(--text-secondary)',
        marginTop: 4,
      }}>
        {value.length}/1000
      </div>
    </section>
  );
}
