'use client';

import { BarChart2, ExternalLink } from 'lucide-react';

const A = { bg: '#0f0e0c', card: '#1a1917', border: '#2a2927', orange: '#ff6b35', muted: '#666', text: '#e8e3db' };

export default function AdsPage() {
  return (
    <div style={{ padding: '32px 40px', maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <div style={{ background: 'rgba(255,107,53,0.12)', borderRadius: 10, padding: 10 }}>
          <BarChart2 size={22} color={A.orange} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: A.text, margin: 0 }}>Meta Ads</h1>
          <p style={{ color: A.muted, fontSize: 13, margin: '2px 0 0' }}>Rendimiento de campañas de captación</p>
        </div>
      </div>

      <div style={{ marginTop: 32, background: A.card, border: `1px solid ${A.border}`, borderRadius: 14, padding: 36, textAlign: 'center' }}>
        <BarChart2 size={48} color={A.border} style={{ marginBottom: 16 }} />
        <h2 style={{ fontSize: 17, fontWeight: 700, color: A.text, margin: '0 0 10px' }}>Próximamente</h2>
        <p style={{ color: A.muted, fontSize: 13, lineHeight: 1.6, maxWidth: 400, margin: '0 auto 24px' }}>
          La integración con Meta Ads API para ver campañas, leads y coste por adquisición está en desarrollo.
          Por ahora puedes gestionar tus anuncios directamente en Meta Ads Manager.
        </p>
        <a
          href="https://adsmanager.facebook.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: A.orange, color: '#fff', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
        >
          <ExternalLink size={14} /> Abrir Meta Ads Manager
        </a>
      </div>

      <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {['Leads totales', 'Coste por lead', 'CTR medio'].map((label) => (
          <div key={label} style={{ background: A.card, border: `1px solid ${A.border}`, borderRadius: 10, padding: '18px 20px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: A.border }}>—</div>
            <div style={{ fontSize: 12, color: A.muted, marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
