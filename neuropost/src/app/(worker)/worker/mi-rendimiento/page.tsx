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

export default function MiRendimientoPage() {
  const [metrics, setMetrics] = useState({ totalValidated: 0, approvalRate: 0, avgResponseTimeH: '0', rejected: 0 });

  useEffect(() => {
    fetch('/api/worker/metricas?mine=1').then((r) => r.json()).then(setMetrics);
  }, []);

  return (
    <div style={{ padding: '32px 40px', maxWidth: 800 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 6 }}>Mi rendimiento</h1>
      <p style={{ color: C.muted, fontSize: 14, marginBottom: 28 }}>Tus estadísticas personales de este mes</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Posts validados este mes', value: metrics.totalValidated, color: C.accent2 },
          { label: 'Tasa de aprobación de clientes', value: `${metrics.approvalRate}%`, color: C.green },
          { label: 'Tiempo medio de respuesta', value: `${metrics.avgResponseTimeH}h`, color: C.orange },
          { label: 'Posts rechazados', value: metrics.rejected, color: C.red },
        ].map((card) => (
          <div key={card.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: '24px 28px' }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>{card.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: C.muted, marginBottom: 16 }}>RESUMEN</h2>
        <p style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>
          Este mes has validado <strong style={{ color: C.accent2 }}>{metrics.totalValidated}</strong> posts con una tasa de aprobación del{' '}
          <strong style={{ color: C.green }}>{metrics.approvalRate}%</strong>.
          Tu tiempo medio de respuesta es de <strong style={{ color: C.orange }}>{metrics.avgResponseTimeH} horas</strong>.
        </p>
      </div>
    </div>
  );
}
