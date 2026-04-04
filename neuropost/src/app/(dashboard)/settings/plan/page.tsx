'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Check, ExternalLink } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { SubscriptionPlan } from '@/types';
import CouponInput from '@/components/billing/CouponInput';

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
            border:      `1px solid ${error ? '#ef4444' : message ? '#22c55e' : 'var(--border)'}`,
            borderRadius: 8,
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
            background:  !code.trim() || loading ? '#fdba74' : 'var(--orange)',
            color:       'white',
            border:      'none',
            borderRadius: 8,
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
        <p style={{ fontSize: 13, color: '#16a34a', marginTop: 6, fontFamily: 'Cabinet Grotesk, sans-serif' }}>
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
  price:   string;
  perks:   string[];
  popular: boolean;
}[] = [
  {
    id:      'starter',
    name:    'Starter',
    price:   '29€/mes',
    perks:   ['2 posts/semana', 'Instagram o Facebook', 'Generación con IA', 'Planificador de contenido', 'Aprobación manual'],
    popular: false,
  },
  {
    id:      'pro',
    name:    'Pro',
    price:   '69€/mes',
    perks:   ['5 posts + 3 historias/semana', 'Instagram + Facebook', 'Publicación automática', 'Análisis de métricas', '14 días de prueba gratis'],
    popular: true,
  },
  {
    id:      'total',
    name:    'Total',
    price:   '129€/mes',
    perks:   ['7 posts + 7 historias/semana', 'Agente competencia', 'Detección de tendencias', 'Analytics avanzado', 'Estilos visuales IA'],
    popular: false,
  },
  {
    id:      'agency',
    name:    'Agency',
    price:   '199€/mes',
    perks:   ['Todo lo de Total', 'Hasta 10 marcas', 'Panel multicliente', 'Soporte prioritario 24 h'],
    popular: false,
  },
];

export default function PlanPage() {
  const brand       = useAppStore((s) => s.brand);
  const params      = useSearchParams();
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
              <span style={{ marginLeft: 8, background: '#e6f9f0', color: '#1a7a45', padding: '2px 8px', borderRadius: 20, fontSize: 12 }}>
                Prueba gratis activa
              </span>
            )}
          </p>
        </div>
        <Link href="/settings" style={{ fontSize: 13, color: 'var(--muted)' }}>← Ajustes</Link>
      </div>

      {subStatus?.discount && (
        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 10, padding: '12px 16px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>🏷️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#92400e' }}>
              Descuento activo
              {subStatus.discount.code && (
                <span style={{ fontFamily: 'monospace', background: '#fde68a', padding: '1px 6px', borderRadius: 4, marginLeft: 6 }}>
                  {subStatus.discount.code}
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: '#b45309', marginTop: 2 }}>
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

      {/* Plans grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 32 }}>
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          return (
            <div
              key={plan.id}
              style={{
                border:       `2px solid ${plan.popular ? 'var(--orange)' : isCurrent ? 'var(--ink)' : 'var(--border)'}`,
                borderRadius: 14,
                padding:      24,
                position:     'relative',
                background:   isCurrent ? 'var(--orange-light, #fff5f0)' : '#fff',
              }}
            >
              {plan.popular && (
                <span style={{
                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--orange)', color: '#fff', padding: '3px 14px',
                  borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                }}>
                  MÁS POPULAR
                </span>
              )}
              {isCurrent && (
                <span style={{
                  position: 'absolute', top: -12, right: 16,
                  background: 'var(--ink)', color: '#fff', padding: '3px 14px',
                  borderRadius: 20, fontSize: 11, fontWeight: 700,
                }}>
                  ACTIVO
                </span>
              )}

              <p style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 800, fontSize: 18, marginBottom: 4 }}>{plan.name}</p>
              <p style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--orange)', marginBottom: 16 }}>{plan.price}</p>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {plan.perks.map((perk) => (
                  <li key={perk} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink)' }}>
                    <Check size={14} style={{ color: 'var(--orange)', flexShrink: 0 }} />
                    {perk}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <button className="btn-outline btn-full" disabled style={{ opacity: 0.5 }}>Plan actual</button>
              ) : (
                <button
                  className={plan.popular ? 'btn-primary btn-full' : 'btn-outline btn-full'}
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

      {/* Apply coupon to existing subscription */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 24, marginTop: 32 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Aplicar código de descuento</h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)' }}>
          Si tienes un código promocional, puedes aplicarlo a tu suscripción actual. El descuento se aplicará a partir del próximo ciclo de facturación.
        </p>
        <ApplyCouponForm />
      </div>
    </div>
  );
}
