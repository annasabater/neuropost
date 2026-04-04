'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { locales, localeNames, localeFlags, defaultLocale, type Locale } from '@/i18n/config';

function getStoredLocale(): Locale {
  if (typeof document === 'undefined') return defaultLocale;
  const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/);
  const raw = match?.[1];
  return (locales as readonly string[]).includes(raw ?? '') ? (raw as Locale) : defaultLocale;
}

export function LanguageSelector() {
  const router  = useRouter();
  const [open,    setOpen]    = useState(false);
  const [current, setCurrent] = useState<Locale>(defaultLocale);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrent(getStoredLocale());
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function changeLocale(loc: Locale) {
    document.cookie = `NEXT_LOCALE=${loc}; path=/; max-age=31536000; SameSite=Lax`;
    setCurrent(loc);
    setOpen(false);
    router.refresh();
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="topbar-icon-btn"
        title="Cambiar idioma / Change language"
        aria-label="Language selector"
        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 20, fontSize: '0.82rem', fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 600 }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>{localeFlags[current]}</span>
        <span style={{ display: 'none' }} className="lang-label">{localeNames[current]}</span>
        <span style={{ fontSize: 9, opacity: 0.6 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position:   'absolute',
          top:        'calc(100% + 6px)',
          right:      0,
          background: 'var(--surface)',
          border:     '1px solid var(--border)',
          borderRadius: 12,
          overflow:   'hidden',
          boxShadow:  '0 8px 32px rgba(0,0,0,0.12)',
          minWidth:   160,
          zIndex:     100,
        }}>
          {locales.map((loc) => (
            <button
              key={loc}
              onClick={() => changeLocale(loc)}
              style={{
                width:       '100%',
                padding:     '10px 16px',
                display:     'flex',
                alignItems:  'center',
                gap:         10,
                background:  loc === current ? 'var(--orange-light)' : 'transparent',
                color:       loc === current ? 'var(--orange)' : 'var(--muted)',
                border:      'none',
                cursor:      'pointer',
                fontSize:    '0.85rem',
                fontFamily:  "'Cabinet Grotesk', sans-serif",
                fontWeight:  loc === current ? 700 : 500,
                textAlign:   'left',
                transition:  'background 0.15s',
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{localeFlags[loc]}</span>
              <span>{localeNames[loc]}</span>
              {loc === current && <span style={{ marginLeft: 'auto', fontSize: 12 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
