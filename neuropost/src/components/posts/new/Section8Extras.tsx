'use client';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

interface Props {
  extraNotes:      string;
  proposedCaption: string;
  onNotes:         (v: string) => void;
  onCaption:       (v: string) => void;
}

export function Section8Extras({ extraNotes, proposedCaption, onNotes, onCaption }: Props) {
  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{
          fontFamily: fc, fontWeight: 900, fontSize: 22,
          textTransform: 'uppercase', letterSpacing: '0.02em',
          color: 'var(--text-primary)', marginBottom: 4,
        }}>
          7 — Detalles adicionales <span style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontWeight: 400, fontSize: 14, textTransform: 'none', letterSpacing: 0, color: 'var(--text-secondary)' }}>(opcional)</span>
        </h2>
        <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-secondary)' }}>
          Todo opcional. Cuánto más detalle, mejor resultado.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{
            display: 'block', fontFamily: f, fontSize: 10, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-secondary)', marginBottom: 6,
          }}>
            Notas adicionales
          </label>
          <textarea
            value={extraNotes}
            onChange={(e) => onNotes(e.target.value)}
            placeholder="Cualquier detalle extra, restricciones, ideas concretas…"
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box',
              border: '1px solid var(--border)', padding: '10px 12px',
              fontFamily: f, fontSize: 13, lineHeight: 1.5,
              background: 'var(--bg)', color: 'var(--text-primary)',
              resize: 'vertical', outline: 'none', borderRadius: 0,
            }}
          />
        </div>

        <div>
          <label style={{
            display: 'block', fontFamily: f, fontSize: 10, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-secondary)', marginBottom: 6,
          }}>
            Caption propuesto <span style={{ fontWeight: 400, textTransform: 'none' }}>(si ya tienes uno en mente)</span>
          </label>
          <textarea
            value={proposedCaption}
            onChange={(e) => onCaption(e.target.value)}
            placeholder="Escribe aquí el texto que quieres para la publicación…"
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box',
              border: '1px solid var(--border)', padding: '10px 12px',
              fontFamily: f, fontSize: 13, lineHeight: 1.5,
              background: 'var(--bg)', color: 'var(--text-primary)',
              resize: 'vertical', outline: 'none', borderRadius: 0,
            }}
          />
        </div>
      </div>
    </section>
  );
}
