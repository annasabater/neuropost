'use client';

import React from 'react';

const f = "var(--font-barlow), 'Barlow', sans-serif";

export function DataForm({
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
        <label style={labelStyle}>Cifra / dato *</label>
        <input value={(value.label as string) ?? ''} onChange={e => set('label', e.target.value)} placeholder="Ej: 15 años" style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Contexto *</label>
        <input value={(value.description as string) ?? ''} onChange={e => set('description', e.target.value)} placeholder="Ej: de experiencia en el sector" style={inputStyle} />
      </div>
    </div>
  );
}
