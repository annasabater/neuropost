'use client';

import { MOCK_SUBSCRIPTION, MOCK_PAYMENT_METHOD, MOCK_INVOICES, MOCK_USAGE } from '@/lib/billing/mock-data';
import PaymentsDisabledBanner from './PaymentsDisabledBanner';
import CurrentPlanCard from './CurrentPlanCard';
import PlansGrid from './PlansGrid';
import PaymentMethodCard from './PaymentMethodCard';
import InvoicesTable from './InvoicesTable';
import SubscriptionDangerZone from './SubscriptionDangerZone';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

function SectionHead({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18, gap: 16 }}>
      <div>
        <h2 style={{ fontFamily: fc, fontWeight: 700, fontSize: 24, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 2 }}>{title}</h2>
        <div style={{ color: 'var(--muted)', fontSize: 14, fontFamily: f }}>{subtitle}</div>
      </div>
      {action}
    </div>
  );
}

export default function BillingClient({ paymentsEnabled }: { paymentsEnabled: boolean }) {
  const disabled = !paymentsEnabled;

  const subscription = MOCK_SUBSCRIPTION;
  const usage = MOCK_USAGE;
  const paymentMethod = MOCK_PAYMENT_METHOD;
  const invoices = MOCK_INVOICES;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px 80px' }}>

      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', fontFamily: f, marginBottom: 10 }}>
          Cuenta · Facturación
        </div>
        <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(32px, 5vw, 44px)', lineHeight: 1.05, color: 'var(--text-primary)', marginBottom: 10, textTransform: 'uppercase' }}>
          Plan y facturación
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 16, fontFamily: f, maxWidth: 580 }}>
          Gestiona tu suscripción, método de pago y descarga tus facturas. Los cambios se aplican al siguiente ciclo.
        </p>
      </div>

      {disabled && <PaymentsDisabledBanner />}

      <section style={{ marginBottom: 48 }}>
        <SectionHead title="Tu plan actual" subtitle="Resumen de tu suscripción activa" />
        <CurrentPlanCard subscription={subscription} usage={usage} />
      </section>

      <section style={{ marginBottom: 48 }}>
        <SectionHead title="Cambiar de plan" subtitle="Actualiza o baja de plan en cualquier momento" />
        <PlansGrid currentPlan={subscription.plan} disabled={disabled} />
      </section>

      <section style={{ marginBottom: 48 }}>
        <SectionHead
          title="Método de pago"
          subtitle="Tarjeta que se cargará en cada ciclo"
          action={
            <button disabled={disabled} style={{
              padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-primary)', fontFamily: f,
              fontWeight: 500, fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
            }}>+ Añadir tarjeta</button>
          }
        />
        <PaymentMethodCard method={paymentMethod} disabled={disabled} />
      </section>

      <section style={{ marginBottom: 48 }}>
        <SectionHead
          title="Historial de facturas"
          subtitle="Descarga tus facturas en PDF para contabilidad"
          action={
            <a href="#" style={{ color: 'var(--accent)', fontFamily: f, fontWeight: 500, fontSize: 14, textDecoration: 'none' }}>
              Ver todas →
            </a>
          }
        />
        <InvoicesTable invoices={invoices} />
      </section>

      <section style={{ marginBottom: 48 }}>
        <SubscriptionDangerZone disabled={disabled} />
      </section>
    </div>
  );
}
