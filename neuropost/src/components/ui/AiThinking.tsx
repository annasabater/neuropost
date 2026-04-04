'use client';

import { useEffect, useState } from 'react';

const MESSAGES = [
  'Analizando tu foto...',
  'Entendiendo tu marca...',
  'Generando el caption perfecto...',
  'Eligiendo los mejores hashtags...',
  'Calculando la mejor hora...',
  'Casi listo...',
];

export function AiThinking() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setIdx((i) => (i + 1) % MESSAGES.length), 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '40px 20px' }}>
      <div style={{
        width:         48,
        height:        48,
        borderRadius:  '50%',
        background:    'var(--orange-light)',
        display:       'flex',
        alignItems:    'center',
        justifyContent:'center',
        fontSize:      24,
        animation:     'pulse 1.5s infinite',
      }}>
        ✦
      </div>

      <p style={{
        fontFamily:  "'Cabinet Grotesk', sans-serif",
        fontSize:    '0.88rem',
        fontWeight:  600,
        color:       'var(--muted)',
        textAlign:   'center',
        transition:  'opacity 0.3s ease',
        minHeight:   20,
      }}>
        {MESSAGES[idx]}
      </p>

      <div style={{ display: 'flex', gap: 6 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            width:      8,
            height:     8,
            borderRadius: '50%',
            background: 'var(--orange)',
            animation:  `bounce 1s infinite ${i * 0.2}s`,
          }} />
        ))}
      </div>
    </div>
  );
}
