'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, ChevronRight } from 'lucide-react';

const C = {
  card: '#ffffff', border: '#E5E7EB', text: '#111111',
  muted: '#6B7280', accent: '#0F766E',
};

interface PlanRow {
  id:                string;
  week_start:        string;
  status:            string;
  created_at:        string;
  client_approved_at?: string | null;
  sent_to_client_at?:  string | null;
}

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  generating:           { label: 'Generando',          color: '#6B7280', bg: '#f5f5f5' },
  ideas_ready:          { label: 'Listo (worker)',      color: '#f59e0b', bg: '#fef3c7' },
  sent_to_client:       { label: 'Enviado',             color: '#3b82f6', bg: '#eff6ff' },
  client_reviewing:     { label: 'Para revisar',        color: '#0F766E', bg: '#f0fdf4' },
  client_approved:      { label: 'Aprobado',            color: '#10b981', bg: '#f0fdf4' },
  client_requested_variation: { label: 'Con cambios',  color: '#f59e0b', bg: '#fef3c7' },
  producing:            { label: 'En producción',       color: '#8b5cf6', bg: '#f5f3ff' },
  calendar_ready:       { label: 'Calendario listo',   color: '#10b981', bg: '#f0fdf4' },
  completed:            { label: 'Completado',          color: '#10b981', bg: '#f0fdf4' },
  auto_approved:        { label: 'Auto-aprobado',       color: '#6B7280', bg: '#f5f5f5' },
  skipped_by_client:    { label: 'Saltada',             color: '#ef4444', bg: '#fef2f2' },
  expired:              { label: 'Expirado',            color: '#ef4444', bg: '#fef2f2' },
};

export default function PlanificacionPage() {
  const router = useRouter();
  const [plans, setPlans]   = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/client/weekly-plans')
      .then((r) => r.json())
      .then((d: { plans?: PlanRow[] }) => { setPlans(d.plans ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40, color: C.muted }}>Cargando planes...</div>;

  return (
    <div style={{ padding: 28, maxWidth: 800, color: C.text }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px' }}>Planificación</h1>
        <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
          Historial de propuestas semanales de contenido
        </p>
      </div>

      {plans.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', border: `1px solid ${C.border}` }}>
          <Calendar size={40} style={{ color: C.muted, margin: '0 auto 12px', display: 'block' }} />
          <p style={{ color: C.muted, fontSize: 14 }}>Aún no tienes planes de contenido.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, border: `1px solid ${C.border}` }}>
          {plans.map((plan) => {
            const meta  = STATUS_LABEL[plan.status] ?? { label: plan.status, color: C.muted, bg: '#f5f5f5' };
            const isReviewable = plan.status === 'client_reviewing';
            return (
              <div
                key={plan.id}
                onClick={() => router.push(`/planificacion/${plan.id}`)}
                style={{
                  background: C.card, padding: '14px 20px',
                  display: 'flex', alignItems: 'center', gap: 16,
                  borderBottom: `1px solid ${C.border}`,
                  cursor: 'pointer',
                }}
              >
                <Calendar size={18} style={{ color: C.muted, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>
                    Semana del {formatWeek(plan.week_start)}
                  </span>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                    {plan.client_approved_at
                      ? `Aprobado el ${new Date(plan.client_approved_at).toLocaleDateString('es-ES')}`
                      : `Creado el ${new Date(plan.created_at).toLocaleDateString('es-ES')}`}
                  </div>
                </div>
                <span style={{
                  fontSize: 11, padding: '3px 8px', background: meta.bg, color: meta.color,
                  borderRadius: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4,
                }}>
                  {meta.label}
                </span>
                {isReviewable && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.accent, display: 'flex', alignItems: 'center', gap: 4 }}>
                    Revisar <ChevronRight size={13} />
                  </span>
                )}
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
