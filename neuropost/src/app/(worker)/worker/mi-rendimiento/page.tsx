'use client';

import { useEffect, useState } from 'react';

const W = { bg: '#0a0a14', card: '#111827', border: '#1e2533', blue: '#3b82f6', text: '#e5e7eb', muted: '#6b7280' };

export default function MiRendimientoPage() {
  const [metrics, setMetrics] = useState({ totalValidated: 0, approvalRate: 0, avgResponseTimeH: '0', rejected: 0 });

  useEffect(() => {
    fetch('/api/worker/metricas?mine=1').then((r) => r.json()).then(setMetrics);
  }, []);

  return (
    <div style={{ padding: '32px 40px', maxWidth: 800 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: W.text, marginBottom: 6 }}>Mi rendimiento</h1>
      <p style={{ color: W.muted, fontSize: 14, marginBottom: 28 }}>Tus estadísticas personales de este mes</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Posts validados este mes', value: metrics.totalValidated, color: W.blue },
          { label: 'Tasa de aprobación de clientes', value: `${metrics.approvalRate}%`, color: '#14B8A6' },
          { label: 'Tiempo medio de respuesta', value: `${metrics.avgResponseTimeH}h`, color: '#f59e0b' },
          { label: 'Posts rechazados', value: metrics.rejected, color: '#ef4444' },
        ].map((card) => (
          <div key={card.label} style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 12, padding: '24px 28px' }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: 13, color: W.muted, marginTop: 6 }}>{card.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 12, padding: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: W.muted, marginBottom: 16 }}>RESUMEN</h2>
        <p style={{ fontSize: 13, color: W.text, lineHeight: 1.7 }}>
          Este mes has validado <strong style={{ color: W.blue }}>{metrics.totalValidated}</strong> posts con una tasa de aprobación del{' '}
          <strong style={{ color: '#14B8A6' }}>{metrics.approvalRate}%</strong>.
          Tu tiempo medio de respuesta es de <strong style={{ color: '#f59e0b' }}>{metrics.avgResponseTimeH} horas</strong>.
        </p>
      </div>
    </div>
  );
}
