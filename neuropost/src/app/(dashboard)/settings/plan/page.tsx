'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { Brand, SubscriptionPlan } from '@/types';
import { PLAN_META } from '@/types';
import CouponInput from '@/components/billing/CouponInput';

type BillingCycle = 'monthly' | 'annual';

// ─── Inline ApplyCouponForm ───────────────────────────────────────────────────

function ApplyCouponForm() {
  const [code,    setCode]    = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error,   setError]   = useState('');

  async function handleApply() {
    if (!code.trim() || loading) return;
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const res  = await fetch('/api/stripe/apply-coupon', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ code: code.trim() }),
      });
      const json = await res.json();
      if (res.ok) {
        setMessage(json.message ?? 'Descuento aplicado correctamente');
        setCode('');
      } else {
        setError(json.error ?? 'Error al aplicar el código');
      }
    } catch {
      setError('Error de conexión al aplicar el código');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setMessage(''); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleApply(); }}
          placeholder="CODIGO2026"
          style={{
            border:      `1px solid ${error ? '#ef4444' : message ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 0,
            padding:     '10px 14px',
            fontFamily:  'Cabinet Grotesk, sans-serif',
            fontSize:    14,
            width:       '100%',
            outline:     'none',
          }}
        />
        <button
          type="button"
          onClick={handleApply}
          disabled={!code.trim() || loading}
          style={{
            background:  !code.trim() || loading ? '#9ca3af' : 'var(--accent)',
            color:       'white',
            border:      'none',
            borderRadius: 0,
            padding:     '10px 20px',
            fontWeight:  700,
            cursor:      !code.trim() || loading ? 'not-allowed' : 'pointer',
            fontFamily:  'Cabinet Grotesk, sans-serif',
            fontSize:    14,
            whiteSpace:  'nowrap',
          }}
        >
          {loading ? '...' : 'Aplicar →'}
        </button>
      </div>
      {message && (
        <p style={{ fontSize: 13, color: '#0F766E', marginTop: 6, fontFamily: 'Cabinet Grotesk, sans-serif' }}>
          ✓ {message}
        </p>
      )}
      {error && (
        <p style={{ fontSize: 13, color: '#dc2626', marginTop: 6, fontFamily: 'Cabinet Grotesk, sans-serif' }}>
          ✗ {error}
        </p>
      )}
    </div>
  );
}

const PLANS: {
  id:           SubscriptionPlan;
  name:         string;
  monthlyPrice: number;
  annualPrice:  number;  // price per month when billed annually
  annualSavings: number; // total annual savings vs monthly
  desc:         string;
  perks:        string[];
  featured:     boolean;
  badge?:       string;
}[] = [
  {
    id:           'starter',
    name:         'Starter',
    monthlyPrice:  25,
    annualPrice:   21,
    annualSavings: 48,
    desc: 'Para tener una presencia activa y profesional en redes',
    perks: [
      '2 posts de foto por semana',
      'Carruseles hasta 3 fotos',
      'Publicación programada',
      'Edición y creación de contenido',
      'Solicitudes de contenido personalizadas',
      'Generación con IA integrada',
      'Calendario de contenido básico',
    ],
    featured: false,
  },
  {
    id:           'pro',
    name:         'Pro',
    monthlyPrice:  76,
    annualPrice:   63,
    annualSavings: 156,
    desc: 'Para convertir tus redes en una máquina de ventas',
    perks: [
      '4 fotos + 2 vídeos por semana',
      'Carruseles hasta 8 fotos',
      'Publicación programada y calendario avanzado',
      'Ideas de contenido + creación a medida',
      'Mejores horas para publicar',
      'Solicitudes de contenido personalizadas',
      'Análisis de rendimiento y mejoras',
      'Generación con IA integrada',
      'Soporte prioritario',
    ],
    featured: true,
    badge: '⚡ Más popular',
  },
  {
    id:           'total',
    name:         'Total',
    monthlyPrice:  161,
    annualPrice:   133,
    annualSavings: 336,
    desc: 'Para convertir tus redes en tu principal canal de captación de clientes',
    perks: [
      'Hasta 20 fotos + 10 vídeos por semana',
      'Carruseles hasta 20 fotos',
      'Publicación programada y calendario avanzado',
      'Ideas + contenido basado en tendencias',
      'Solicitudes de contenido personalizadas',
      'Análisis de rendimiento y mejoras continuas',
      'Generación con IA integrada',
      'Soporte prioritario 24h',
    ],
    featured: false,
    badge: '🚀 Completo',
  },
];

export default function PlanPage() {
  const brand       = useAppStore((s) => s.brand);
  const setBrand    = useAppStore((s) => s.setBrand);
  const params      = useSearchParams();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');
  const [billing,   setBilling]   = useState(false);
  const [upgrading, setUpgrading] = useState<SubscriptionPlan | null>(null);
  const [promoCodeId, setPromoCodeId] = useState<string | null>(null);
  const [, setDiscountText] = useState('');
  const refreshedRef = useRef(false);

  const [subStatus, setSubStatus] = useState<{
    status: string;
    currentPeriodEnd?: number;
    discount?: {
      code?: string;
      percentOff?: number;
      amountOff?: number;
      endsAt?: number;
      duration: string;
      durationInMonths?: number;
    } | null;
  } | null>(null);

  // After returning from Stripe checkout, refresh the brand in the global store
  // so the new plan propagates to the whole app immediately.
  useEffect(() => {
    if (params.get('success') !== 'true' || refreshedRef.current) return;
    refreshedRef.current = true;
    toast.success('Plan activado correctamente');

    // Webhook may have a few seconds delay — poll up to 8s until plan changes
    const startPlan = brand?.plan;
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res  = await fetch('/api/brands');
        const data = await res.json() as { brand?: Brand };
        if (data.brand) {
          setBrand(data.brand);
          if (data.brand.plan !== startPlan || attempts >= 4) {
            clearInterval(interval);
          }
        }
      } catch { /* non-blocking */ }
      if (attempts >= 4) clearInterval(interval);
    }, 2000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    if (params.get('cancelled') === 'true') toast.error('Pago cancelado');
  }, [params]);

  useEffect(() => {
    fetch('/api/stripe/subscription-status')
      .then((r) => r.json())
      .then((data) => setSubStatus(data))
      .catch(() => {});
  }, []);

  async function handleUpgrade(plan: SubscriptionPlan) {
    setUpgrading(plan);
    try {
      const res  = await fetch('/api/stripe/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan, ...(promoCodeId ? { promoCodeId } : {}) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error');
      if (json.url) window.location.href = json.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setUpgrading(null);
    }
  }

  async function openPortal() {
    setBilling(true);
    try {
      const res  = await fetch('/api/stripe/portal', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error');
      window.location.href = json.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setBilling(false);
    }
  }

  const currentPlan = brand?.plan ?? 'starter';

  const f  = "var(--font-barlow), 'Barlow', sans-serif";
  const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

  return (
    <div className="page-content">
      {/* Back link */}
      <a
        href="/settings#plan"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 20,
          fontFamily: f, fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none',
          padding: '7px 14px', border: '1px solid var(--border)', background: 'var(--bg-1)',
        }}
      >
        <ArrowLeft size={14} /> Volver a Ajustes
      </a>

      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Elige tu plan</h1>
          <p className="page-sub">
            Plan activo:{' '}
            <strong style={{ fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {PLAN_META[currentPlan].label}
            </strong>
            {brand?.trial_ends_at && new Date(brand.trial_ends_at) > new Date() && (
              <span style={{ marginLeft: 8, background: '#e6f9f0', color: '#1a7a45', padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
                Prueba gratis activa hasta el{' '}
                {new Date(brand.trial_ends_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              </span>
            )}
            {brand?.plan_cancels_at && (
              <span style={{ marginLeft: 8, background: '#fff3e0', color: '#e65100', padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
                Cancela el {new Date(brand.plan_cancels_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </p>
        </div>
      </div>

      {subStatus?.discount && (
        <div style={{ background: 'var(--accent-light)', border: '1px solid var(--accent)', borderRadius: 0, padding: '12px 16px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>🏷️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)' }}>
              Descuento activo
              {subStatus.discount.code && (
                <span style={{ fontFamily: 'monospace', background: 'var(--accent-soft)', color: 'var(--accent)', padding: '1px 6px', borderRadius: 0, marginLeft: 6 }}>
                  {subStatus.discount.code}
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--accent)', marginTop: 2 }}>
              {subStatus.discount.percentOff
                ? `${subStatus.discount.percentOff}% de descuento`
                : subStatus.discount.amountOff
                  ? `${subStatus.discount.amountOff}€ de descuento`
                  : ''}
              {subStatus.discount.duration === 'once'
                ? ' · válido un mes'
                : subStatus.discount.duration === 'repeating' && subStatus.discount.durationInMonths
                  ? ` · ${subStatus.discount.durationInMonths} meses`
                  : ' · para siempre'}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <div style={{ display: 'inline-flex', background: '#ffffff', border: '1px solid var(--border)', borderRadius: 0, padding: '4px', gap: '4px' }}>
          {(['monthly', 'annual'] as const).map((cycle) => (
            <button
              key={cycle}
              onClick={() => setBillingCycle(cycle)}
              style={{
                padding: '9px 22px',
                borderRadius: 0,
                border: 'none',
                cursor: 'pointer',
                fontFamily: "var(--font-barlow), 'Barlow', sans-serif",
                fontWeight: 700,
                fontSize: '0.88rem',
                transition: 'all 0.2s',
                background: billingCycle === cycle ? 'var(--accent)' : 'transparent',
                color: billingCycle === cycle ? '#ffffff' : 'var(--text-secondary)',
              }}
            >
              {cycle === 'monthly' ? 'Mensual' : 'Anual'}
              {cycle === 'annual' && (
                <span
                  style={{
                    marginLeft: '6px',
                    background: billingCycle === 'annual' ? 'rgba(255,255,255,0.2)' : 'var(--accent-light)',
                    color: billingCycle === 'annual' ? '#ffffff' : 'var(--accent)',
                    borderRadius: 0,
                    padding: '2px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                  }}
                >
                  −15%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Plans grid */}
      <div style={{ overflowX: 'auto', overflowY: 'visible', paddingTop: 10, paddingBottom: 4, marginBottom: 32 }}>
      <div className="pricing-grid" style={{ minWidth: 720, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, alignItems: 'stretch' }}>
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const displayPrice = billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
          const savings = plan.annualSavings;

          return (
            <div
              key={plan.id}
              className={`plan${plan.featured ? ' featured' : ''}`}
            >
              {plan.badge && (
                <div className="plan-badge">{plan.badge}</div>
              )}

              {isCurrent && (
                <span style={{
                  position: 'absolute', top: -12, right: 16,
                  background: 'var(--ink)', color: '#fff', padding: '3px 14px',
                  borderRadius: 0, fontSize: 11, fontWeight: 700,
                }}>
                  ACTIVO
                </span>
              )}

              <div className="plan-name">{plan.name}</div>
              <div className="plan-price">
                <sup>€</sup>
                {displayPrice}
                <span>/mes</span>
              </div>

              {billingCycle === 'annual' && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: plan.featured ? 'rgba(15,118,110,0.22)' : 'var(--accent-light)',
                    color: plan.featured ? '#7cf5ea' : 'var(--accent)',
                    fontFamily: "var(--font-barlow), 'Barlow', sans-serif",
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    padding: '4px 12px',
                    borderRadius: 0,
                    marginBottom: '8px',
                  }}
                >
                  Ahorras €{savings}/año
                </div>
              )}

              <div className="plan-desc">{plan.desc}</div>

              <ul className="plan-features">
                {plan.perks.map((perk) => (
                  <li key={perk}>{perk}</li>
                ))}
              </ul>

              {isCurrent ? (
                <button className="plan-btn" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>Plan actual</button>
              ) : (
                <button
                  className="plan-btn"
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={upgrading === plan.id}
                >
                  {upgrading === plan.id ? <><span className="loading-spinner" />Redirigiendo...</> : `Activar ${plan.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
      </div>

      {/* Coupon for upgrade */}
      <div style={{ marginBottom: 32 }}>
        <CouponInput
          onValidCoupon={(id, text) => { setPromoCodeId(id); setDiscountText(text); }}
          onClearCoupon={() => { setPromoCodeId(null); setDiscountText(''); }}
        />
      </div>

      {/* Billing portal */}
      {brand?.stripe_customer_id && (
        <div className="settings-section">
          <h2 className="settings-section-title">Gestionar suscripción</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
            Actualiza tu método de pago, descarga facturas o cancela tu suscripción.
          </p>
          <button className="btn-outline" onClick={openPortal} disabled={billing}>
            {billing ? <span className="loading-spinner" /> : <ExternalLink size={14} />}
            Portal de facturación →
          </button>
        </div>
      )}

    </div>
  );
}
