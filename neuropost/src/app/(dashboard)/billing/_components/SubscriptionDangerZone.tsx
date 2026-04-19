'use client';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

export default function SubscriptionDangerZone({ disabled }: { disabled?: boolean }) {
  return (
    <div style={{
      padding: '28px 32px', border: '1px solid #FECACA', borderRadius: 14,
      background: 'linear-gradient(180deg, #FEF7F7 0%, var(--surface) 60%)',
    }}>
      <h2 style={{ fontFamily: fc, fontWeight: 700, fontSize: 24, color: '#B91C1C', marginBottom: 6, letterSpacing: '-0.02em' }}>
        Gestionar suscripción
      </h2>
      <p style={{ color: 'var(--muted)', fontSize: 14, fontFamily: f, marginBottom: 20, maxWidth: 540 }}>
        Puedes pausar tu suscripción hasta 3 meses (mantienes tus datos y conexiones) o cancelarla al final del ciclo actual. No hay permanencia.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button disabled={disabled} style={{
          padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border)',
          background: 'transparent', color: 'var(--text-primary)', fontFamily: f,
          fontWeight: 500, fontSize: 14, cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}>Pausar suscripción</button>
        <button disabled={disabled} style={{
          padding: '10px 16px', borderRadius: 8, border: '1px solid #FECACA',
          background: 'transparent', color: '#B91C1C', fontFamily: f,
          fontWeight: 500, fontSize: 14, cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}>Cancelar suscripción</button>
      </div>
    </div>
  );
}
