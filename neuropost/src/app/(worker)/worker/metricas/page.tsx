'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw }                         from 'lucide-react';

const C = {
  bg: '#ffffff',
  bg1: '#f5f5f5',
  card: '#ffffff',
  border: '#E5E7EB',
  text: '#111111',
  muted: '#6B7280',
  accent: '#0F766E',
  accent2: '#3B82F6',
  red: '#EF4444',
  orange: '#F59E0B',
  green: '#14B8A6',
};

interface LegacyMetrics {
  totalValidated:   number;
  approvalRate:     number;
  avgResponseTimeH: string;
  rejected:         number;
}

interface FlowMetrics {
  period_days: number;
  plans: {
    total:               number;
    by_status:           Record<string, number>;
    auto_approved_count: number;
    auto_approved_rate:  number;
  };
  timings: {
    avg_generated_to_sent_hours: number;
    avg_sent_to_approved_hours:  number;
  };
  retouches: {
    total:          number;
    per_plan_avg:   number;
    resolved_count: number;
    rejected_count: number;
    rejection_rate: number;
  };
}

export default function MetricasPage() {
  const [legacy,  setLegacy]  = useState<LegacyMetrics>({ totalValidated: 0, approvalRate: 0, avgResponseTimeH: '0', rejected: 0 });
  const [flow,    setFlow]    = useState<FlowMetrics | null>(null);
  const [workers, setWorkers] = useState<{ id: string; full_name: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [legacyRes, flowRes, workersRes] = await Promise.all([
      fetch('/api/worker/metricas').then((r) => r.json()),
      fetch('/api/worker/metrics').then((r) => r.json()),
      fetch('/api/worker/trabajadores').then((r) => r.json()),
    ]);
    setLegacy(legacyRes as LegacyMetrics);
    setFlow(flowRes as FlowMetrics);
    setWorkers((workersRes as { workers?: typeof workers }).workers ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>Métricas del sistema</h1>
        <button
          onClick={load}
          disabled={loading}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', background: 'transparent', border: `1px solid ${C.border}`,
            color: C.muted, cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 12, fontFamily: 'inherit', opacity: loading ? 0.6 : 1,
          }}
        >
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : undefined }} />
          Actualizar
        </button>
      </div>

      {/* ── Sección: Validación de contenido (legacy) ── */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 14px' }}>
        Validación de contenido (mes actual)
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 36 }}>
        {[
          { label: 'Posts validados',  value: legacy.totalValidated },
          { label: 'Tasa aprobación',  value: `${legacy.approvalRate}%`,     color: C.green },
          { label: 'Tiempo medio',     value: `${legacy.avgResponseTimeH}h`, color: C.orange },
          { label: 'Rechazados',       value: legacy.rejected,               color: C.red },
        ].map((card) => (
          <div key={card.label} style={{ background: C.card, border: `1px solid ${C.border}`, padding: 20 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: card.color ?? C.accent2 }}>{card.value}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* ── Sección: KPIs del flujo (Sprint 8) ── */}
      {flow && (
        <>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 14px' }}>
            Flujo de planes — últimos {flow.period_days} días
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
            {[
              { label: 'Planes generados',          value: flow.plans.total },
              { label: 'Auto-aprobados',            value: `${flow.plans.auto_approved_count} (${pct(flow.plans.auto_approved_rate)})`, color: C.green },
              { label: 'Worker → cliente (media)',  value: `${flow.timings.avg_generated_to_sent_hours}h`,  color: C.orange },
              { label: 'Cliente → aprobar (media)', value: `${flow.timings.avg_sent_to_approved_hours}h`,   color: C.accent2 },
              { label: 'Retoques totales',          value: flow.retouches.total },
              { label: 'Retoques / plan',           value: flow.retouches.per_plan_avg },
              { label: 'Retoques resueltos',        value: flow.retouches.resolved_count, color: C.green },
              { label: 'Retoques rechazados',       value: `${flow.retouches.rejected_count} (${pct(flow.retouches.rejection_rate)})`, color: C.red },
            ].map((card) => (
              <div key={card.label} style={{ background: C.card, border: `1px solid ${C.border}`, padding: 20 }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: card.color ?? C.text }}>{card.value}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{card.label}</div>
              </div>
            ))}
          </div>

          {/* by_status breakdown */}
          {Object.keys(flow.plans.by_status).length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: '16px 20px', marginBottom: 36 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' }}>
                Distribución de estados de planes
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {Object.entries(flow.plans.by_status).map(([st, n]) => (
                  <div key={st} style={{ fontSize: 13, color: C.text }}>
                    <span style={{ color: C.muted }}>{st}:</span> <strong>{n}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Sección: Equipo ── */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 14px' }}>
        Equipo de trabajadores
      </h2>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.bg1 }}>
              {['Trabajador', 'Rol', 'Estado'].map((h) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {workers.map((w) => (
              <tr key={w.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '12px 16px', fontSize: 13, color: C.text }}>{w.full_name}</td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: C.muted, textTransform: 'capitalize' }}>{w.role}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.green }}>Activo</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}
