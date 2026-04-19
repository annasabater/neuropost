'use client';

import { useEffect, useState }  from 'react';
import { usePathname, useRouter } from 'next/navigation';

const VALID_PATHS = ['/worker', '/worker/validation', '/worker/metricas'];

function isOnValidPath(pathname: string): boolean {
  return (
    pathname === '/worker' ||
    pathname.startsWith('/worker/validation') ||
    pathname.startsWith('/worker/metricas')
  );
}

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

const C = {
  border: '#E5E7EB',
  text:   '#111111',
  muted:  '#6B7280',
  accent: '#0F766E',
  bg:     '#ffffff',
  bg1:    '#f5f5f5',
};

export function WorkerTopTabs() {
  const pathname = usePathname();
  const router   = useRouter();
  const [badge,  setBadge]  = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res  = await fetch('/api/worker/validation-pending-counts');
        if (!res.ok) return;
        const data = await res.json() as { total?: number };
        if (!cancelled) { setBadge(data.total ?? 0); setLoaded(true); }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    }
    void load();
    // Refresh every 60 seconds
    const interval = setInterval(() => { void load(); }, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (!isOnValidPath(pathname)) return null;

  const tabs: { key: string; label: string; path: string; badge?: number }[] = [
    { key: 'overview',   label: 'Overview',   path: '/worker' },
    { key: 'validation', label: 'Validación', path: '/worker/validation', badge: loaded && badge > 0 ? badge : undefined },
    { key: 'metricas',   label: 'Métricas',   path: '/worker/metricas' },
  ];

  function activeKey(): string {
    if (pathname.startsWith('/worker/validation')) return 'validation';
    if (pathname.startsWith('/worker/metricas'))   return 'metricas';
    return 'overview';
  }

  const current = activeKey();

  return (
    <div style={{
      borderBottom: `2px solid ${C.border}`,
      background:   C.bg,
      display:      'flex',
      paddingLeft:  40,
      gap:          0,
      fontFamily:   f,
    }}>
      {tabs.map((tab) => {
        const active = current === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => router.push(tab.path)}
            style={{
              display:        'inline-flex',
              alignItems:     'center',
              gap:            6,
              padding:        '12px 20px',
              background:     'none',
              border:         'none',
              borderBottom:   active ? `2px solid ${C.accent}` : '2px solid transparent',
              marginBottom:   -2,
              color:          active ? C.accent : C.muted,
              fontWeight:     active ? 700 : 400,
              fontSize:       14,
              fontFamily:     f,
              cursor:         'pointer',
              textTransform:  'uppercase' as const,
              letterSpacing:  '0.04em',
              whiteSpace:     'nowrap' as const,
            }}
          >
            <span style={{ fontFamily: fc }}>{tab.label}</span>
            {tab.badge !== undefined && (
              <span style={{
                display:        'inline-flex',
                alignItems:     'center',
                justifyContent: 'center',
                minWidth:       20,
                height:         20,
                padding:        '0 6px',
                background:     active ? C.accent : '#EF4444',
                color:          '#fff',
                fontSize:       11,
                fontWeight:     700,
                fontFamily:     f,
                borderRadius:   0,
                lineHeight:     1,
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
