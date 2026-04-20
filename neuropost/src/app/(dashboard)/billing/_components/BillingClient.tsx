'use client';

import { useEffect, useState } from 'react';
import { PLAN_META, type SubscriptionPlan } from '@/types';
import type { BillingInvoice } from '@/lib/billing/types';
import PaymentsDisabledBanner from './PaymentsDisabledBanner';
import CurrentPlanCard from './CurrentPlanCard';
import PlansGrid from './PlansGrid';
import PaymentMethodCard from './PaymentMethodCard';
import InvoicesTable from './InvoicesTable';
import SubscriptionDangerZone from './SubscriptionDangerZone';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

type BrandProp = {
  id: string;
  plan: SubscriptionPlan;
  planLabel: string;
  priceMonthly: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  planStartedAt: string | null;
  subscribedPlatforms: string[];
};

type SubStatus = {
  plan: SubscriptionPlan;
  status: string;
  currentPeriodEnd: number | null;
  trialEnd: number | null;
  cancelAtPeriodEnd: boolean;
  discount: { code: string | null; percentOff: number | null; amountOff: number | null } | null;
};

type PaymentMethod = {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  holderName: string | null;
};

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

export default function BillingClient({ paymentsEnabled, brand }: { paymentsEnabled: boolean; brand: BrandProp | null }) {
  const disabled = !paymentsEnabled;

  const [subStatus, setSubStatus] = useState<SubStatus | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!brand) { setLoading(false); return; }

    async function fetchData() {
      try {
        const [subRes, invRes] = await Promise.all([
          fetch('/api/stripe/subscription-status'),
          brand!.stripeCustomerId ? fetch('/api/billing/invoices') : Promise.resolve(null),
        ]);

        if (subRes.ok) {
          const data = await subRes.json();
          setSubStatus(data);
        }

        if (invRes?.ok) {
          const data = await invRes.json();
          setInvoices(data.invoices ?? []);
        }
      } catch {
        // silently fail — UI shows what it can
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [brand]);

  // Derive subscription display data from brand + API response
  const planId = subStatus?.plan ?? brand?.plan ?? 'starter';
  const meta = PLAN_META[planId];
  const statusLabel = subStatus?.status === 'trialing' ? 'En prueba'
    : subStatus?.status === 'active' ? 'Activo'
    : subStatus?.status === 'past_due' ? 'Pago pendiente'
    : subStatus?.status === 'canceled' ? 'Cancelado'
    : brand?.stripeSubscriptionId ? 'Activo' : 'Sin suscripción';

  const nextBillingDate = subStatus?.currentPeriodEnd
    ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(subStatus.currentPeriodEnd * 1000))
    : null;

  const startedAt = brand?.planStartedAt
    ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(brand.planStartedAt))
    : null;

  const subscription = brand ? {
    planLabel: meta?.label ?? planId,
    priceMonthly: meta?.price ?? 0,
    status: statusLabel,
    nextPaymentDate: nextBillingDate ?? '—',
    startedAt: startedAt ?? '—',
    cancelAtPeriodEnd: subStatus?.cancelAtPeriodEnd ?? false,
    trialEnd: subStatus?.trialEnd ? new Date(subStatus.trialEnd * 1000) : null,
  } : null;

  const usage = {
    aiPosts: { used: 0, limit: 100 }, // TODO: fetch from real usage API
    businesses: { used: 1, limit: 1 },
    socialNetworks: { used: brand?.subscribedPlatforms?.length ?? 0, limit: '∞' as string | number },
  };

  async function openPortal() {
    const res = await fetch('/api/stripe/portal', { method: 'POST' });
    if (res.ok) {
      const { url } = await res.json();
      window.location.href = url;
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px 80px' }}>
        <div style={{ height: 20, width: 120, background: 'var(--border)', borderRadius: 4, marginBottom: 12 }} />
        <div style={{ height: 44, width: 320, background: 'var(--border)', borderRadius: 6, marginBottom: 36 }} />
        <div style={{ height: 240, background: 'var(--border)', borderRadius: 14, opacity: 0.5 }} />
      </div>
    );
  }

  if (!brand) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 32, color: 'var(--text-primary)', marginBottom: 12 }}>Configura tu negocio primero</h1>
        <p style={{ fontFamily: f, color: 'var(--muted)', fontSize: 16, marginBottom: 24 }}>Para gestionar tu plan necesitas completar el onboarding.</p>
        <a href="/onboarding" style={{ fontFamily: f, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', fontSize: 15 }}>Ir al onboarding →</a>
      </div>
    );
  }

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
        <CurrentPlanCard subscription={subscription!} usage={usage} />
      </section>

      <section style={{ marginBottom: 48 }}>
        <SectionHead title="Cambiar de plan" subtitle="Actualiza o baja de plan en cualquier momento" />
        <PlansGrid currentPlan={planId} disabled={disabled} />
      </section>

      <section style={{ marginBottom: 48 }}>
        <SectionHead
          title="Método de pago"
          subtitle="Tarjeta que se cargará en cada ciclo"
          action={
            <button disabled={disabled} onClick={openPortal} style={{
              padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-primary)', fontFamily: f,
              fontWeight: 500, fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
            }}>+ Gestionar tarjeta</button>
          }
        />
        <PaymentMethodCard method={paymentMethod} disabled={disabled} onManage={openPortal} />
      </section>

      {invoices.length > 0 && (
        <section style={{ marginBottom: 48 }}>
          <SectionHead title="Historial de facturas" subtitle="Descarga tus facturas en PDF para contabilidad" />
          <InvoicesTable invoices={invoices} />
        </section>
      )}

      <section style={{ marginBottom: 48 }}>
        <SubscriptionDangerZone disabled={disabled} onManage={openPortal} />
      </section>
    </div>
  );
}
