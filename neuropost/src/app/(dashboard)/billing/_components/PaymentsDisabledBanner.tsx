'use client';

const f = "var(--font-barlow), 'Barlow', sans-serif";

export default function PaymentsDisabledBanner() {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 14,
      padding: '16px 20px',
      background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12,
      marginBottom: 32, fontFamily: f, fontSize: 14,
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%', background: '#F59E0B',
        color: '#fff', display: 'grid', placeItems: 'center',
        fontWeight: 700, fontSize: 13, flexShrink: 0,
      }}>!</div>
      <div>
        <strong style={{ display: 'block', marginBottom: 2, color: '#92400E' }}>Pagos en modo preview</strong>
        <span style={{ color: '#78350F', fontSize: 13 }}>
          La integración con Stripe está lista pero desactivada hasta configurar las variables de entorno. Los clientes pueden ver todo pero no se cobrará.
        </span>
      </div>
    </div>
  );
}
