'use client';

import type { BillingSubscription, BillingUsage } from '@/lib/billing/mock-data';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

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

export default function CurrentPlanCard({ subscription, usage }: { subscription: BillingSubscription; usage: BillingUsage }) {
  const statusColor = subscription.status === 'active' ? 'var(--accent)' : '#F59E0B';
  const statusLabel = subscription.status === 'active' ? 'Activo' : subscription.status === 'trialing' ? 'Período de prueba' : subscription.status;

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', display: 'grid', gridTemplateColumns: '1.4fr 1fr' }}>

      {/* Left */}
      <div style={{ padding: '28px 32px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'var(--accent-light)', color: 'var(--accent-dark, var(--accent))',
          padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, fontFamily: f,
          marginBottom: 14,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />
          {statusLabel}
        </div>

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
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, fontFamily: f }}>Método</div>
            <div style={{ fontSize: 14, fontWeight: 500, fontFamily: f }}>Visa ···· 4242</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, fontFamily: f }}>Inicio</div>
            <div style={{ fontSize: 14, fontWeight: 500, fontFamily: f }}>{subscription.startedAt}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, fontFamily: f }}>Estado</div>
            <div style={{ fontSize: 14, fontWeight: 500, fontFamily: f, color: 'var(--accent)' }}>Al corriente</div>
          </div>
        </div>
      </div>

      {/* Right — usage */}
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
