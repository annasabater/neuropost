'use client';

import React from 'react';

const f = "var(--font-barlow), 'Barlow', sans-serif";

export function QuoteForm({
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
        <label style={labelStyle}>Frase *</label>
        <textarea value={(value.text as string) ?? ''} onChange={e => set('text', e.target.value)} rows={3} placeholder="Ej: La artesanía no se improvisa, se cultiva." style={{ ...inputStyle, resize: 'vertical' }} />
      </div>
      <div>
        <label style={labelStyle}>Autor (opcional)</label>
        <input value={(value.author as string) ?? ''} onChange={e => set('author', e.target.value)} placeholder="Ej: María García, fundadora" style={inputStyle} />
      </div>
    </div>
  );
}
