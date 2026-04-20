'use client';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

type Subscription = {
  planLabel: string;
  priceMonthly: number;
  status: string;
  nextPaymentDate: string;
  startedAt: string;
  cancelAtPeriodEnd: boolean;
  trialEnd: Date | null;
};

type Usage = {
  aiPosts: { used: number; limit: number };
  businesses: { used: number; limit: number };
  socialNetworks: { used: number; limit: string | number };
};

function UsageBar({ label, used, limit }: { label: string; used: number; limit: string | number }) {
  const pct = typeof limit === 'number' ? Math.min((used / limit) * 100, 100) : 40;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontFamily: f, marginBottom: 6 }}>
        <span>{label}</span>
        <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{used} / {limit}</span>
      </div>
      <div style={{ height: 6, background: 'rgba(15,118,110,0.1)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 999, width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function CurrentPlanCard({ subscription, usage }: { subscription: Subscription; usage: Usage }) {
  const isActive = subscription.status === 'Activo' || subscription.status === 'En prueba';
  const statusColor = isActive ? 'var(--accent)' : '#F59E0B';

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', display: 'grid', gridTemplateColumns: '1.4fr 1fr' }}>
      <div style={{ padding: '28px 32px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'var(--accent-light)', color: 'var(--accent)',
          padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, fontFamily: f, marginBottom: 14,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />
          {subscription.status}
        </div>

        {subscription.trialEnd && (
          <p style={{ fontFamily: f, fontSize: 12, color: '#F59E0B', marginBottom: 8 }}>
            Período de prueba hasta el {new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' }).format(subscription.trialEnd)}
          </p>
        )}

        {subscription.cancelAtPeriodEnd && (
          <p style={{ fontFamily: f, fontSize: 12, color: '#B91C1C', marginBottom: 8 }}>
            Se cancelará al final del ciclo actual
          </p>
        )}

        <div style={{ fontFamily: fc, fontWeight: 500, fontSize: 30, letterSpacing: '-0.02em', marginBottom: 6, color: 'var(--text-primary)' }}>
          Plan {subscription.planLabel}
        </div>
        <div style={{ color: 'var(--muted)', fontSize: 14, fontFamily: f, marginBottom: 20 }}>
          <b style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{subscription.priceMonthly} €</b> / mes · Facturación mensual
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px', paddingTop: 20, borderTop: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, fontFamily: f }}>Próximo cobro</div>
            <div style={{ fontSize: 14, fontWeight: 500, fontFamily: f }}>{subscription.nextPaymentDate}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, fontFamily: f }}>Inicio</div>
            <div style={{ fontSize: 14, fontWeight: 500, fontFamily: f }}>{subscription.startedAt}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, fontFamily: f }}>Estado</div>
            <div style={{ fontSize: 14, fontWeight: 500, fontFamily: f, color: isActive ? 'var(--accent)' : '#F59E0B' }}>
              {isActive ? 'Al corriente' : subscription.status}
            </div>
          </div>
        </div>
      </div>

      <div style={{
        background: 'linear-gradient(135deg, var(--accent-light) 0%, #F4FAF7 100%)',
        padding: '28px 32px', borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: -60, top: -60, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(15,118,110,0.12), transparent 70%)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', fontFamily: f, marginBottom: 14 }}>Uso de este ciclo</div>
          <UsageBar label="Posts generados con IA" used={usage.aiPosts.used} limit={usage.aiPosts.limit} />
          <UsageBar label="Negocios conectados" used={usage.businesses.used} limit={usage.businesses.limit} />
          <UsageBar label="Redes sociales" used={usage.socialNetworks.used} limit={usage.socialNetworks.limit} />
        </div>
      </div>
    </div>
  );
}
