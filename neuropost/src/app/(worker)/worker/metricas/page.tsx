'use client';

import { useEffect, useState } from 'react';

const W = { bg: '#0a0a14', card: '#111827', border: '#1e2533', blue: '#3b82f6', text: '#e5e7eb', muted: '#6b7280' };

export default function MetricasPage() {
  const [metrics, setMetrics] = useState({ totalValidated: 0, approvalRate: 0, avgResponseTimeH: '0', rejected: 0 });
  const [workers, setWorkers] = useState<{ id: string; full_name: string; role: string }[]>([]);

  useEffect(() => {
    fetch('/api/worker/metricas').then((r) => r.json()).then(setMetrics);
    fetch('/api/worker/trabajadores').then((r) => r.json()).then((d) => setWorkers(d.workers ?? []));
  }, []);

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1000 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: W.text, marginBottom: 24 }}>Métricas del equipo</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Posts validados', value: metrics.totalValidated },
          { label: 'Tasa aprobación', value: `${metrics.approvalRate}%`, color: '#14B8A6' },
          { label: 'Tiempo medio', value: `${metrics.avgResponseTimeH}h`, color: '#f59e0b' },
          { label: 'Rechazados', value: metrics.rejected, color: '#ef4444' },
        ].map((card) => (
          <div key={card.label} style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: card.color ?? W.blue }}>{card.value}</div>
            <div style={{ fontSize: 12, color: W.muted, marginTop: 4 }}>{card.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${W.border}`, fontSize: 14, fontWeight: 700, color: W.text }}>
          Equipo de trabajadores
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#0f172a' }}>
              {['Trabajador', 'Rol', 'Estado'].map((h) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: W.muted, letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {workers.map((w) => (
              <tr key={w.id} style={{ borderBottom: `1px solid ${W.border}` }}>
                <td style={{ padding: '12px 16px', fontSize: 13, color: W.text }}>{w.full_name}</td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: W.muted, textTransform: 'capitalize' }}>{w.role}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#14B8A6' }}>Activo</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
