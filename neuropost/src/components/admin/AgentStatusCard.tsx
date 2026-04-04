'use client';

import { useState } from 'react';

interface Props {
  name:        string;
  active:      boolean;
  todayCount:  number;
  todayLabel:  string;
  onToggle:    (active: boolean) => void;
}

export function AgentStatusCard({ name, active, todayCount, todayLabel, onToggle }: Props) {
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try { onToggle(!active); }
    finally { setLoading(false); }
  }

  return (
    <div style={{
      background:   '#1a1917',
      border:       `1px solid ${active ? 'rgba(74,222,128,0.3)' : '#2a2927'}`,
      borderRadius: 10,
      padding:      '14px 16px',
      display:      'flex',
      alignItems:   'center',
      gap:          12,
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: active ? '#4ade80' : '#444',
        flexShrink: 0,
        boxShadow: active ? '0 0 6px #4ade80' : 'none',
      }} />
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 700, fontSize: 13, color: '#e8e3db', margin: 0 }}>{name}</p>
        <p style={{ fontSize: 11, color: '#555', margin: '2px 0 0' }}>
          {todayCount} {todayLabel}
        </p>
      </div>
      <span style={{ fontSize: 11, color: active ? '#4ade80' : '#555', fontWeight: 700 }}>
        {active ? 'ACTIVO' : 'PAUSADO'}
      </span>
      <button
        onClick={toggle}
        disabled={loading}
        style={{
          padding:    '5px 12px',
          borderRadius: 6,
          background: active ? 'rgba(255,255,255,0.05)' : 'rgba(255,107,53,0.15)',
          color:      active ? '#888' : '#ff6b35',
          border:     'none',
          cursor:     loading ? 'not-allowed' : 'pointer',
          fontSize:   12,
          fontWeight: 600,
        }}
      >
        {loading ? '...' : active ? 'Pausar' : 'Activar'}
      </button>
    </div>
  );
}
