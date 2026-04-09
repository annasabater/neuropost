'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { ExternalLink } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { SubscriptionPlan } from '@/types';
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
          placeholder="CODIGO2025"
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
  id:      SubscriptionPlan;
  name:    string;
  monthlyPrice: number;
  desc: string;
  perks:   string[];
  featured: boolean;
  badge?: string;
}[] = [
  {
    id:      'starter',
    name:    'Starter',
    monthlyPrice:   29,
    desc: 'Para empezar con presencia constante en redes',
    perks:   ['2 posts/semana', 'Instagram o Facebook', 'Generación con IA', 'Planificador de contenido', 'Aprobación manual'],
    featured: false,
  },
  {
    id:      'pro',
    name:    'Pro',
    monthlyPrice:   69,
    desc: 'Para crecer con foto, vídeo y automatización',
    perks:   ['5 posts + 3 historias/semana', 'Instagram + Facebook', 'Publicación automática', 'Análisis de métricas', '14 días de prueba gratis'],
    featured: true,
    badge: '⚡ Más popular',
  },
  {
    id:      'total',
    name:    'Total',
    monthlyPrice:   129,
    desc: 'Para escalar volumen con soporte y operación avanzada',
    perks:   ['7 posts + 7 historias/semana', 'Agente competencia', 'Detección de tendencias', 'Analytics avanzado', 'Estilos visuales IA'],
    featured: false,
    badge: '🚀 Completo',
  },
  {
    id:      'agency',
    name:    'Agency',
    monthlyPrice:   199,
    desc: 'Para agencias y gestión de múltiples marcas',
    perks:   ['Todo lo de Total', 'Hasta 10 marcas', 'Panel multicliente', 'Soporte prioritario 24 h'],
    featured: false,
  },
];

function annualPrice(monthly: number): number {
  return Math.round(monthly * 0.8);
}

function annualSavings(monthly: number): number {
  return Math.round((monthly - annualPrice(monthly)) * 12);
}

export default function PlanPage() {
  const brand       = useAppStore((s) => s.brand);
  const params      = useSearchParams();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');
  const [billing,   setBilling]   = useState(false);
  const [upgrading, setUpgrading] = useState<SubscriptionPlan | null>(null);
  const [promoCodeId, setPromoCodeId] = useState<string | null>(null);
  const [, setDiscountText] = useState('');

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

  useEffect(() => {
    if (params.get('success') === 'true')    toast.success('🎉 Plan activado correctamente');
    if (params.get('cancelled') === 'true')  toast.error('Pago cancelado');
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

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Plan y facturación</h1>
          <p className="page-sub">Plan actual: <strong style={{ textTransform: 'capitalize' }}>{currentPlan}</strong>
            {brand?.trial_ends_at && new Date(brand.trial_ends_at) > new Date() && (
              <span style={{ marginLeft: 8, background: '#e6f9f0', color: '#1a7a45', padding: '2px 8px', borderRadius: 0, fontSize: 12 }}>
                Prueba gratis activa
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
                  −20%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Plans grid */}
      <div style={{ overflowX: 'auto', overflowY: 'visible', paddingTop: 10, paddingBottom: 4, marginBottom: 32 }}>
      <div className="pricing-grid" style={{ minWidth: 1040, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, alignItems: 'stretch' }}>
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const displayPrice = billingCycle === 'annual' ? annualPrice(plan.monthlyPrice) : plan.monthlyPrice;
          const savings = annualSavings(plan.monthlyPrice);

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
