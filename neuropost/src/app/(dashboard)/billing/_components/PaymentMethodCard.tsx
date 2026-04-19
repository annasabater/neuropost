'use client';

const f = "var(--font-barlow), 'Barlow', sans-serif";

type PaymentMethod = {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  holderName: string | null;
} | null;

export default function PaymentMethodCard({ method, disabled, onManage }: { method: PaymentMethod; disabled?: boolean; onManage?: () => void }) {
  if (!method) {
    return (
      <div style={{
        padding: '28px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap', background: 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(15,118,110,0.025) 8px, rgba(15,118,110,0.025) 16px)',
        border: '1px dashed var(--border)', borderRadius: 14,
      }}>
        <div>
          <strong style={{ display: 'block', marginBottom: 3, fontFamily: f }}>Sin método de pago</strong>
          <span style={{ color: 'var(--muted)', fontSize: 13, fontFamily: f }}>Añade una tarjeta para activar tu suscripción</span>
        </div>
        <button disabled={disabled} onClick={onManage} style={{
          padding: '10px 16px', borderRadius: 8, border: 'none',
          background: 'var(--accent)', color: '#fff', fontFamily: f,
          fontWeight: 500, fontSize: 14, cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}>+ Añadir tarjeta</button>
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
      padding: '22px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 44, height: 32, borderRadius: 6,
          background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: '4px 5px', flexShrink: 0,
        }}>
          <span style={{ color: '#fff', fontSize: 8, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{method.brand}</span>
        </div>
        <div>
          <div style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums', fontFamily: f }}>
            {method.brand} ···· {method.last4}
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 13, fontFamily: f }}>
            Expira {String(method.expMonth).padStart(2, '0')}/{method.expYear}
            {method.holderName && ` · ${method.holderName}`}
          </div>
        </div>
      </div>
      <button disabled={disabled} onClick={onManage} style={{
        padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)',
        background: 'transparent', color: 'var(--text-primary)', fontFamily: f,
        fontWeight: 500, fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}>Gestionar</button>
    </div>
  );
}
