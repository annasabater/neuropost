'use client';

import React from 'react';

const f = "var(--font-barlow), 'Barlow', sans-serif";

export function FreeForm({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--border)', fontFamily: f, fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text-primary)', boxSizing: 'border-box' };
  const labelStyle: React.CSSProperties = { fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 };

  return (
    <div>
      <label style={labelStyle}>Texto *</label>
      <textarea
        value={(value.text as string) ?? ''}
        onChange={e => onChange({ text: e.target.value })}
        rows={5}
        placeholder="Escribe cualquier información relevante de tu marca que quieras que los agentes tengan en cuenta..."
        style={{ ...inputStyle, resize: 'vertical' }}
      />
    </div>
  );
}
