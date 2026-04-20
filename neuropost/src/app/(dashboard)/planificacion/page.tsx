'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar } from 'lucide-react';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

interface PlanRow {
  id:                string;
  week_start:        string;
  status:            string;
  created_at:        string;
  client_approved_at?: string | null;
  sent_to_client_at?:  string | null;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  generating:               { label: 'Generando',         color: '#92400e', bg: '#fef3c7', dot: '#f59e0b' },
  ideas_ready:              { label: 'Listo (worker)',     color: '#92400e', bg: '#fef3c7', dot: '#f59e0b' },
  sent_to_client:           { label: 'Enviado',            color: '#1e40af', bg: '#eff6ff', dot: '#3b82f6' },
  client_reviewing:         { label: 'Para revisar',       color: '#065f46', bg: '#d1fae5', dot: '#10b981' },
  client_approved:          { label: 'Aprobado',           color: '#065f46', bg: '#d1fae5', dot: '#10b981' },
  client_requested_variation:{ label: 'Con cambios',       color: '#92400e', bg: '#fef3c7', dot: '#f59e0b' },
  producing:                { label: 'En producción',      color: '#4c1d95', bg: '#ede9fe', dot: '#8b5cf6' },
  calendar_ready:           { label: 'Calendario listo',  color: '#065f46', bg: '#d1fae5', dot: '#10b981' },
  completed:                { label: 'Completado',         color: '#374151', bg: '#f3f4f6', dot: '#9ca3af' },
  auto_approved:            { label: 'Auto-aprobado',      color: '#374151', bg: '#f3f4f6', dot: '#9ca3af' },
  skipped_by_client:        { label: 'Saltada',            color: '#991b1b', bg: '#fee2e2', dot: '#ef4444' },
  expired:                  { label: 'Expirado',           color: '#991b1b', bg: '#fee2e2', dot: '#ef4444' },
};

type FilterTab = 'all' | 'reviewing' | 'active' | 'historic';

const REVIEWING_STATUSES = new Set(['client_reviewing', 'sent_to_client', 'ideas_ready']);
const ACTIVE_STATUSES    = new Set(['generating', 'producing', 'calendar_ready', 'client_requested_variation']);
const HISTORIC_STATUSES  = new Set(['completed', 'auto_approved', 'skipped_by_client', 'expired', 'client_approved']);

function getFilter(status: string): FilterTab {
  if (REVIEWING_STATUSES.has(status)) return 'reviewing';
  if (ACTIVE_STATUSES.has(status))    return 'active';
  if (HISTORIC_STATUSES.has(status))  return 'historic';
  return 'active';
}

export default function PlanificacionPage() {
  const router = useRouter();
  const [plans, setPlans]     = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<FilterTab>('all');

  useEffect(() => {
    fetch('/api/client/weekly-plans')
      .then((r) => r.json())
      .then((d: { plans?: PlanRow[] }) => { setPlans(d.plans ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const counts = useMemo(() => ({
    all:       plans.length,
    reviewing: plans.filter((p) => getFilter(p.status) === 'reviewing').length,
    active:    plans.filter((p) => getFilter(p.status) === 'active').length,
    historic:  plans.filter((p) => getFilter(p.status) === 'historic').length,
  }), [plans]);

  const visible = tab === 'all' ? plans : plans.filter((p) => getFilter(p.status) === tab);

  if (loading) {
    return (
      <div style={{ padding: 40, color: 'var(--text-secondary)', fontFamily: f }}>
        Cargando planes...
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 28px', maxWidth: 860, color: 'var(--text-primary)', fontFamily: f }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2rem, 4vw, 2.8rem)',
          textTransform: 'uppercase', letterSpacing: '0.02em',
          color: 'var(--text-primary)', margin: '0 0 6px',
          lineHeight: 1,
        }}>
          Planificación
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
          Propuestas semanales de contenido para tu marca
        </p>
      </div>

      {/* ── Filter tabs ── */}
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: '2px solid var(--border)',
        marginBottom: 28,
      }}>
        {([
          ['all',       'Todos'],
          ['reviewing', 'Para revisar'],
          ['active',    'Activos'],
          ['historic',  'Históricos'],
        ] as [FilterTab, string][]).map(([key, label]) => {
          const count   = counts[key];
          const active  = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              style={{
                padding: '10px 18px',
                background: 'none',
                border: 'none',
                borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -2,
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: active ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: f,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {label}
              {count > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  background: active ? 'var(--accent)' : 'var(--bg-1)',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  padding: '1px 6px',
                  borderRadius: 0,
                  minWidth: 20,
                  textAlign: 'center',
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Plan list ── */}
      {visible.length === 0 ? (
        <div style={{
          padding: '64px 32px', textAlign: 'center',
          border: '1px solid var(--border)', background: 'var(--bg)',
        }}>
          <Calendar size={36} style={{ color: 'var(--text-secondary)', margin: '0 auto 16px', display: 'block' }} />
          <p style={{
            fontFamily: fc, fontWeight: 800, fontSize: 18,
            textTransform: 'uppercase', letterSpacing: '0.04em',
            color: 'var(--text-primary)', margin: '0 0 8px',
          }}>
            {tab === 'all' ? 'Sin planes todavía' : 'Nada aquí'}
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
            {tab === 'all'
              ? 'Tu equipo generará el primer plan de contenido pronto.'
              : 'No hay planes en esta categoría.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {visible.map((plan) => {
            const meta        = STATUS_META[plan.status] ?? { label: plan.status, color: '#374151', bg: '#f3f4f6', dot: '#9ca3af' };
            const isReviewable = plan.status === 'client_reviewing';
            const dateLabel   = plan.client_approved_at
              ? `Aprobado el ${new Date(plan.client_approved_at).toLocaleDateString('es-ES')}`
              : `Creado el ${new Date(plan.created_at).toLocaleDateString('es-ES')}`;

            return (
              <div
                key={plan.id}
                onClick={() => router.push(`/planificacion/${plan.id}`)}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-1)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg)')}
              >
                {/* Week info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: fc, fontWeight: 700, fontSize: 16,
                    textTransform: 'uppercase', letterSpacing: '0.03em',
                    color: 'var(--text-primary)', marginBottom: 3,
                  }}>
                    Semana del {formatWeek(plan.week_start)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {dateLabel}
                  </div>
                </div>

                {/* Status pill */}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 11, fontWeight: 700,
                  padding: '4px 10px',
                  background: meta.bg, color: meta.color,
                  borderRadius: 0,
                  textTransform: 'uppercase', letterSpacing: 0.5,
                  flexShrink: 0,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot, flexShrink: 0 }} />
                  {meta.label}
                </span>

                {/* CTA */}
                <span style={{
                  fontSize: 13, fontWeight: 700,
                  color: isReviewable ? 'var(--accent)' : 'var(--text-secondary)',
                  flexShrink: 0,
                  fontFamily: fc,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}>
                  Ver →
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatWeek(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00Z');
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}
