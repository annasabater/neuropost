'use client';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

type TimingPreset = 'today' | 'tomorrow' | 'week' | 'custom';

const PRESETS: { v: TimingPreset; l: string; desc: string }[] = [
  { v: 'today',    l: 'Hoy',           desc: 'Urgente — lo antes posible' },
  { v: 'tomorrow', l: 'Mañana',        desc: 'Entrega en 24 h' },
  { v: 'week',     l: 'Esta semana',   desc: 'En los próximos 7 días' },
  { v: 'custom',   l: 'Fecha concreta',desc: 'Elige el día exacto' },
];

interface Props {
  value:         TimingPreset | null;
  preferredDate: string;
  onChange:      (preset: TimingPreset, date: string) => void;
}

export function Section6Timing({ value, preferredDate, onChange }: Props) {
  function pick(preset: TimingPreset) {
    let date = '';
    if (preset === 'today')    date = new Date().toISOString().slice(0, 10);
    if (preset === 'tomorrow') date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    if (preset === 'week')     date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    onChange(preset, date);
  }

  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{
          fontFamily: fc, fontWeight: 900, fontSize: 22,
          textTransform: 'uppercase', letterSpacing: '0.02em',
          color: 'var(--text-primary)', marginBottom: 4,
        }}>
          6 — Cuándo lo necesitas
        </h2>
        <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-secondary)' }}>
          Opcional. Indica cuándo quieres tener listo el contenido.
        </p>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: '1px', background: 'var(--border)', border: '1px solid var(--border)',
        marginBottom: value === 'custom' ? 12 : 0,
      }}>
        {PRESETS.map((p) => {
          const active = value === p.v;
          return (
            <button
              key={p.v}
              type="button"
              onClick={() => pick(p.v)}
              style={{
                padding: '14px 12px', textAlign: 'left', cursor: 'pointer',
                background: active ? '#111827' : 'var(--bg)',
                border: 'none', outline: 'none',
              }}
            >
              <div style={{
                fontFamily: fc, fontWeight: 900, fontSize: 14,
                textTransform: 'uppercase', letterSpacing: '0.04em',
                color: active ? '#fff' : 'var(--text-primary)', marginBottom: 3,
              }}>
                {p.l}
              </div>
              <div style={{
                fontFamily: f, fontSize: 11,
                color: active ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)',
              }}>
                {p.desc}
              </div>
            </button>
          );
        })}
      </div>

      {value === 'custom' && (
        <input
          type="date"
          value={preferredDate}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => onChange('custom', e.target.value)}
          style={{
            border: '1px solid var(--border)', padding: '10px 12px',
            fontFamily: f, fontSize: 13, background: 'var(--bg)', color: 'var(--text-primary)',
            outline: 'none', width: '100%', boxSizing: 'border-box', borderRadius: 0,
          }}
        />
      )}
    </section>
  );
}
