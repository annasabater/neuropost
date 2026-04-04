'use client';

import { useEffect, useState } from 'react';

export function AppLoader() {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadeOut(true), 800);
    const hideTimer = setTimeout(() => setVisible(false), 1200);
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer); };
  }, []);

  if (!visible) return null;

  return (
    <div style={{
      position:      'fixed',
      inset:         0,
      background:    'var(--cream)',
      display:       'flex',
      alignItems:    'center',
      justifyContent:'center',
      zIndex:        9999,
      transition:    'opacity 0.4s ease',
      opacity:       fadeOut ? 0 : 1,
      pointerEvents: fadeOut ? 'none' : 'all',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <div style={{
          fontFamily:    "'Cabinet Grotesk', sans-serif",
          fontWeight:    900,
          fontSize:      '2rem',
          letterSpacing: '-0.04em',
          color:         'var(--ink)',
          display:       'flex',
          alignItems:    'center',
          gap:           8,
        }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--orange)', animation: 'pulse 1s infinite', display: 'inline-block' }} />
          NeuroPost
        </div>

        <div style={{ width: 160, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'var(--orange)', borderRadius: 2, animation: 'loadBar 1s ease-in-out forwards' }} />
        </div>
      </div>
    </div>
  );
}
