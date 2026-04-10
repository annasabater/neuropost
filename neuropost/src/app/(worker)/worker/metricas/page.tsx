'use client';

import { useEffect, useState } from 'react';

const C = {
  bg: '#ffffff',
  bg1: '#f5f5f5',
  bg2: '#fafafa',
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

export default function MetricasPage() {
  const [metrics, setMetrics] = useState({ totalValidated: 0, approvalRate: 0, avgResponseTimeH: '0', rejected: 0 });
  const [workers, setWorkers] = useState<{ id: string; full_name: string; role: string }[]>([]);

  useEffect(() => {
    fetch('/api/worker/metricas').then((r) => r.json()).then(setMetrics);
    fetch('/api/worker/trabajadores').then((r) => r.json()).then((d) => setWorkers(d.workers ?? []));
  }, []);

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1000 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 24 }}>Métricas del equipo</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Posts validados', value: metrics.totalValidated },
          { label: 'Tasa aprobación', value: `${metrics.approvalRate}%`, color: C.green },
          { label: 'Tiempo medio', value: `${metrics.avgResponseTimeH}h`, color: C.orange },
          { label: 'Rechazados', value: metrics.rejected, color: C.red },
        ].map((card) => (
          <div key={card.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: 20 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: card.color ?? C.accent2 }}>{card.value}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{card.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 700, color: C.text }}>
          Equipo de trabajadores
        </div>
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
