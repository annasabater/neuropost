'use client';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

export function UpgradeToV2Banner({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div style={{
      borderLeft: '3px solid var(--accent)',
      background: 'var(--bg-1)',
      padding: '12px 14px',
      marginBottom: 16,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 240 }}>
        <p style={{
          fontFamily: fc, fontSize: 12, fontWeight: 800,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          color: 'var(--accent)', margin: 0, marginBottom: 2,
        }}>
          Formato anterior
        </p>
        <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
          Actualiza al nuevo formato para desbloquear variantes, ventanas de vigencia, prioridad y plataformas.
        </p>
      </div>
      <button
        type="button"
        onClick={onUpgrade}
        style={{
          padding: '8px 16px',
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          fontFamily: fc, fontSize: 12, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.06em',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        Actualizar al formato nuevo
      </button>
    </div>
  );
}
