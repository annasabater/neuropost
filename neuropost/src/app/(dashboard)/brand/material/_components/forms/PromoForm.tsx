'use client';

import React from 'react';

const f = "var(--font-barlow), 'Barlow', sans-serif";

export function PromoForm({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const set = (k: string, v: string) => onChange({ ...value, [k]: v });
  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--border)', fontFamily: f, fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text-primary)', boxSizing: 'border-box' };
  const labelStyle: React.CSSProperties = { fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label style={labelStyle}>Título *</label>
        <input value={(value.title as string) ?? ''} onChange={e => set('title', e.target.value)} placeholder="Ej: 20% en toda la carta este fin de semana" style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Descripción</label>
        <textarea value={(value.description as string) ?? ''} onChange={e => set('description', e.target.value)} rows={3} placeholder="Detalles de la promo..." style={{ ...inputStyle, resize: 'vertical' }} />
      </div>
      <div>
        <label style={labelStyle}>URL (opcional)</label>
        <input value={(value.url as string) ?? ''} onChange={e => set('url', e.target.value)} placeholder="https://..." style={inputStyle} />
      </div>
    </div>
  );
}
