'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, ChevronRight } from 'lucide-react';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

interface PlanRow {
  id:                  string;
  week_start:          string;
  status:              string;
  created_at:          string;
  client_approved_at?: string | null;
  sent_to_client_at?:  string | null;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  generating:                { label: 'Generando',        color: '#92400e', bg: '#fef3c7', dot: '#f59e0b' },
  ideas_ready:               { label: 'Listo (worker)',   color: '#92400e', bg: '#fef3c7', dot: '#f59e0b' },
  sent_to_client:            { label: 'Enviado',          color: '#1e40af', bg: '#eff6ff', dot: '#3b82f6' },
  client_reviewing:          { label: 'Para revisar',     color: '#065f46', bg: '#d1fae5', dot: '#10b981' },
  client_approved:           { label: 'Aprobado',         color: '#065f46', bg: '#d1fae5', dot: '#10b981' },
  client_requested_variation:{ label: 'Con cambios',      color: '#92400e', bg: '#fef3c7', dot: '#f59e0b' },
  producing:                 { label: 'En producción',    color: '#4c1d95', bg: '#ede9fe', dot: '#8b5cf6' },
  calendar_ready:            { label: 'Calendario listo', color: '#065f46', bg: '#d1fae5', dot: '#10b981' },
  completed:                 { label: 'Completado',       color: '#374151', bg: '#f3f4f6', dot: '#9ca3af' },
  auto_approved:             { label: 'Auto-aprobado',    color: '#374151', bg: '#f3f4f6', dot: '#9ca3af' },
  skipped_by_client:         { label: 'Saltada',          color: '#991b1b', bg: '#fee2e2', dot: '#ef4444' },
  expired:                   { label: 'Expirado',         color: '#991b1b', bg: '#fee2e2', dot: '#ef4444' },
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

const MONTHS_SHORT = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

function getWeekRange(weekStart: string) {
  // +7: week_start is the planning week; show the content week (following week)
  const start = new Date(weekStart + 'T00:00:00Z');
  start.setUTCDate(start.getUTCDate() + 7);
  const end   = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return {
    day:      start.getUTCDate(),
    month:    MONTHS_SHORT[start.getUTCMonth()],
    endDay:   end.getUTCDate(),
    endMonth: MONTHS_SHORT[end.getUTCMonth()],
    year:     start.getUTCFullYear(),
  };
}

function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' });
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
      <div className="page-content dashboard-unified-page" style={{ maxWidth: 860 }}>
        <div className="dashboard-unified-header" style={{ padding: '48px 0 32px' }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ height: 14, width: 180, background: 'var(--bg-2)', marginBottom: 10 }} className="plan-sk" />
            <div style={{ height: 52, width: 320, background: 'var(--bg-2)', marginBottom: 8 }} className="plan-sk" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 0, marginBottom: 28, borderBottom: '2px solid var(--border)', paddingBottom: 12 }}>
          {[100, 110, 80, 100].map((w, i) => (
            <div key={i} style={{ height: 16, width: w, background: 'var(--bg-2)', marginRight: 24 }} className="plan-sk" />
          ))}
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ height: 88, background: 'var(--bg-1)', marginBottom: 2, opacity: 1 - (i - 1) * 0.25 }} className="plan-sk" />
        ))}
        <style>{`@keyframes plan-pulse{0%,100%{opacity:1}50%{opacity:.4}}.plan-sk{animation:plan-pulse 1.6s ease-in-out infinite}`}</style>
      </div>
    );
  }

  return (
    <div className="page-content dashboard-unified-page" style={{ maxWidth: 860, color: 'var(--text-primary)', fontFamily: f }}>

      {/* ── Header ── */}
      <div className="dashboard-unified-header" style={{ padding: '48px 0 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', paddingBottom: 32, borderBottom: '1px solid var(--border)' }}>
          <div>
            <p style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--accent)', margin: '0 0 6px' }}>
              Tu contenido semanal
            </p>
            <h1 style={{
              fontFamily: fc, fontWeight: 900,
              fontSize: 'clamp(2.4rem, 5vw, 3.4rem)',
              textTransform: 'uppercase', letterSpacing: '0.01em',
              color: 'var(--text-primary)', lineHeight: 0.92, margin: 0,
            }}>
              Planificación
            </h1>
          </div>
          {counts.reviewing > 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#d1fae5', border: '1px solid #6ee7b7', flexShrink: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
              <span style={{ fontFamily: fc, fontWeight: 800, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#065f46' }}>
                {counts.reviewing === 1 ? '1 plan pendiente de revisión' : `${counts.reviewing} planes pendientes de revisión`}
              </span>
            </div>
          )}
        </div>
      </div>{/* end dashboard-unified-header */}

      {/* ── Stats strip ── */}
      {plans.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '20px 0', borderBottom: '1px solid var(--border)', marginTop: 16, marginBottom: 0 }}>
          {([
            { label: 'Total',        value: counts.all,       accent: false,                 tab: 'all'       },
            { label: 'Para revisar', value: counts.reviewing, accent: counts.reviewing > 0,  tab: 'reviewing' },
            { label: 'Activos',      value: counts.active,    accent: false,                 tab: 'active'    },
            { label: 'Completados',  value: counts.historic,  accent: false,                 tab: 'historic'  },
          ] as { label: string; value: number; accent: boolean; tab: FilterTab }[]).map(({ label, value, accent, tab: t }, i, arr) => (
            <button key={label} type="button" onClick={() => setTab(t)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 16px', background: 'none', border: 'none',
              borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
              paddingLeft: i === 0 ? 0 : 16, cursor: 'pointer',
            }}>
              <span style={{ fontFamily: fc, fontWeight: 900, fontSize: 18, lineHeight: 1, color: accent ? 'var(--accent)' : 'var(--text-primary)' }}>
                {value}
              </span>
              <span style={{ fontFamily: f, fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {label}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Filter tabs ── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', margin: '16px 0 32px' }}>
        {([
          ['all',       'Todos'],
          ['reviewing', 'Para revisar'],
          ['active',    'Activos'],
          ['historic',  'Históricos'],
        ] as [FilterTab, string][]).map(([key, label]) => {
          const count  = counts[key];
          const active = tab === key;
          return (
            <button key={key} type="button" onClick={() => setTab(key)} style={{
              padding: '12px 18px', background: 'none', border: 'none',
              borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -2,
              color: active ? 'var(--accent)' : 'var(--text-secondary)',
              fontWeight: active ? 700 : 500, fontSize: 13,
              cursor: 'pointer', fontFamily: f,
              display: 'flex', alignItems: 'center', gap: 6, transition: 'color 0.15s',
            }}>
              {label}
              {count > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, background: active ? 'var(--accent)' : 'var(--bg-2)', color: active ? '#fff' : 'var(--text-secondary)', padding: '1px 6px', minWidth: 20, textAlign: 'center' }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Plan list ── */}
      {visible.length === 0 ? (
        <div style={{ padding: '64px 32px', textAlign: 'center', border: '1px solid var(--border)', background: 'var(--bg)' }}>
          <Calendar size={36} style={{ color: 'var(--text-tertiary)', margin: '0 auto 16px', display: 'block' }} />
          <p style={{ fontFamily: fc, fontWeight: 800, fontSize: 18, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-primary)', margin: '0 0 8px' }}>
            {tab === 'all' ? 'Sin planes todavía' : 'Nada aquí'}
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0, lineHeight: 1.6 }}>
            {tab === 'all' ? 'Tu equipo generará el primer plan de contenido pronto.' : 'No hay planes en esta categoría.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {visible.map((plan) => {
            const meta         = STATUS_META[plan.status] ?? { label: plan.status, color: '#374151', bg: '#f3f4f6', dot: '#9ca3af' };
            const isReviewable = plan.status === 'client_reviewing';
            const filter       = getFilter(plan.status);
            const range        = getWeekRange(plan.week_start);
            const isHistoric   = filter === 'historic';
            const dateLabel    = plan.client_approved_at
              ? `Aprobado el ${new Date(plan.client_approved_at).toLocaleDateString('es-ES')}`
              : plan.sent_to_client_at
              ? `Enviado el ${new Date(plan.sent_to_client_at).toLocaleDateString('es-ES')}`
              : `Creado el ${new Date(plan.created_at).toLocaleDateString('es-ES')}`;

            return (
              <div
                key={plan.id}
                onClick={() => router.push(`/planificacion/${plan.id}`)}
                className="plan-card"
                style={{
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  borderLeft: isReviewable ? '3px solid var(--accent)' : '1px solid var(--border)',
                  display: 'flex', alignItems: 'stretch',
                  cursor: 'pointer', overflow: 'hidden',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-1)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg)')}
              >
                <div style={{
                  width: 76, flexShrink: 0,
                  background: isReviewable ? '#f0fdf9' : 'var(--bg-1)',
                  borderRight: '1px solid var(--border)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '16px 8px', gap: 1,
                }}>
                  <span style={{ fontFamily: f, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: isReviewable ? 'var(--accent)' : 'var(--text-tertiary)' }}>
                    {range.month}
                  </span>
                  <span style={{ fontFamily: fc, fontWeight: 900, fontSize: 34, lineHeight: 1, color: isReviewable ? 'var(--accent)' : isHistoric ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
                    {range.day}
                  </span>
                  <span style={{ fontFamily: f, fontSize: 9, color: 'var(--text-tertiary)', lineHeight: 1 }}>{range.year}</span>
                </div>
                <div style={{ flex: 1, padding: '14px 20px', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5 }}>
                  <div style={{ fontFamily: fc, fontWeight: 800, fontSize: 17, textTransform: 'uppercase', letterSpacing: '0.03em', color: isHistoric ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                    Semana del {formatWeekLabel(plan.week_start)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {range.month} {range.day} – {range.endMonth} {range.endDay}
                    </span>
                    <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--bg-3)', flexShrink: 0 }} />
                    <span style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)' }}>{dateLabel}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', flexShrink: 0 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, padding: '4px 10px', background: meta.bg, color: meta.color, textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot, flexShrink: 0 }} />
                    {meta.label}
                  </span>
                  <span style={{ fontFamily: fc, fontWeight: 700, fontSize: 12, color: isReviewable ? 'var(--accent)' : 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                    Ver <ChevronRight size={14} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes plan-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .plan-sk { animation: plan-pulse 1.6s ease-in-out infinite; }
        .plan-card { transition: background 0.12s; }
      `}</style>
    </div>
  );
}
