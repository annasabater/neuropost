'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Check, ExternalLink } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { SubscriptionPlan } from '@/types';

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
  const [billing, setBilling]   = useState(false);
  const [upgrading, setUpgrading] = useState<SubscriptionPlan | null>(null);

  useEffect(() => {
    if (params.get('success') === 'true')    toast.success('🎉 Plan activado correctamente');
    if (params.get('cancelled') === 'true')  toast.error('Pago cancelado');
  }, [params]);

  async function handleUpgrade(plan: SubscriptionPlan) {
    setUpgrading(plan);
    try {
      const res  = await fetch('/api/stripe/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan }),
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
