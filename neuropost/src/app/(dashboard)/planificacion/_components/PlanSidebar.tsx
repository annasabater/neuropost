'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

interface PlanRow {
  id:                  string;
  week_start:          string;
  status:              string;
  created_at:          string;
  client_approved_at?: string | null;
}

const STATUS_DOT: Record<string, { dot: string; label: string }> = {
  generating:                { dot: '#f59e0b', label: 'Generando' },
  ideas_ready:               { dot: '#f59e0b', label: 'Listo (worker)' },
  sent_to_client:            { dot: '#3b82f6', label: 'Enviado' },
  client_reviewing:          { dot: '#10b981', label: 'Para revisar' },
  client_approved:           { dot: '#10b981', label: 'Aprobado' },
  client_requested_variation:{ dot: '#f59e0b', label: 'Con cambios' },
  producing:                 { dot: '#8b5cf6', label: 'En producción' },
  calendar_ready:            { dot: '#10b981', label: 'Cal. listo' },
  completed:                 { dot: '#9ca3af', label: 'Completado' },
  auto_approved:             { dot: '#9ca3af', label: 'Auto-aprobado' },
  skipped_by_client:         { dot: '#ef4444', label: 'Saltada' },
  expired:                   { dot: '#ef4444', label: 'Expirado' },
};

const MONTHS = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

export function PlanSidebar() {
  const router   = useRouter();
  const pathname = usePathname();
  const [plans, setPlans]     = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/client/weekly-plans')
      .then((r) => r.json())
      .then((d: { plans?: PlanRow[] }) => { setPlans(d.plans ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const currentId = pathname.split('/planificacion/')[1]?.split('/')[0] ?? '';

  return (
    <div style={{ fontFamily: f, display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Plan list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {loading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: 60, margin: '2px 8px', background: 'var(--bg-2)', opacity: 1 - (i - 1) * 0.3 }} className="psb-sk" />
            ))}
            <style>{`@keyframes psb-p{0%,100%{opacity:1}50%{opacity:.4}}.psb-sk{animation:psb-p 1.6s ease-in-out infinite}`}</style>
          </>
        ) : plans.map((plan) => {
          const meta    = STATUS_DOT[plan.status] ?? { dot: '#9ca3af', label: plan.status };
          // +7: week_start is the planning week; content is published the following week
          const d       = new Date(plan.week_start + 'T00:00:00Z');
          d.setUTCDate(d.getUTCDate() + 7);
          const day     = d.getUTCDate();
          const month   = MONTHS[d.getUTCMonth()];
          const isActive  = plan.id === currentId;
          const isReview  = plan.status === 'client_reviewing';
          const weekLabel = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });

          return (
            <div
              key={plan.id}
              onClick={() => router.push(`/planificacion/${plan.id}`)}
              className="psb-item"
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px',
                margin: '1px 6px',
                background: isActive ? 'var(--accent)' : 'transparent',
                borderLeft: !isActive && isReview ? '3px solid var(--accent)' : '3px solid transparent',
                cursor: 'pointer',
                transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--bg-1)'; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Date block */}
              <div style={{ width: 32, flexShrink: 0, textAlign: 'center' }}>
                <div style={{ fontFamily: f, fontSize: 7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: isActive ? 'rgba(255,255,255,0.55)' : 'var(--text-tertiary)', lineHeight: 1 }}>
                  {month}
                </div>
                <div style={{ fontFamily: fc, fontWeight: 900, fontSize: 22, lineHeight: 1.1, color: isActive ? '#fff' : 'var(--text-primary)' }}>
                  {day}
                </div>
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: fc, fontWeight: 700, fontSize: 11,
                  textTransform: 'uppercase', letterSpacing: '0.03em',
                  color: isActive ? '#fff' : 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  marginBottom: 3,
                }}>
                  Sem. del {weekLabel}
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: isActive ? 'rgba(255,255,255,0.6)' : meta.dot, flexShrink: 0 }} />
                  <span style={{ fontFamily: f, fontSize: 9, color: isActive ? 'rgba(255,255,255,0.7)' : 'var(--text-tertiary)' }}>
                    {meta.label}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
