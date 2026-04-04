'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type BannerState = 'hidden' | 'visible' | 'expanded';

interface Preferences {
  functional: boolean;
  analytics: boolean;
}

const STORAGE_KEY = 'neuropost_cookies';

function dispatchAnalyticsConsent(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('neuropost:analytics-consent'));
  }
}

export default function CookieBanner() {
  const [state, setState] = useState<BannerState>('hidden');
  const [prefs, setPrefs] = useState<Preferences>({ functional: true, analytics: false });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return; // already decided
    } catch {
      // localStorage not available
    }
    const timer = setTimeout(() => setState('visible'), 500);
    return () => clearTimeout(timer);
  }, []);

  function saveConsent(choice: 'all' | 'necessary' | 'custom', customPrefs?: Preferences): void {
    const value = choice === 'custom' && customPrefs ? JSON.stringify(customPrefs) : choice;
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore
    }

    const analyticsEnabled =
      choice === 'all' ||
      (choice === 'custom' && (customPrefs?.analytics ?? false));

    if (analyticsEnabled) {
      dispatchAnalyticsConsent();
    }

    setState('hidden');
  }

  if (state === 'hidden') return null;

  return (
    <div
      role="dialog"
      aria-label="Preferencias de cookies"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        width: '100%',
        maxWidth: '560px',
        padding: '0 16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
          padding: '20px 24px',
          width: '100%',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px', gap: '12px' }}>
          <p
            style={{
              fontFamily: "'Literata', Georgia, serif",
              fontSize: '0.9rem',
              color: 'var(--ink)',
              lineHeight: '1.6',
              margin: 0,
              flex: 1,
            }}
          >
            Usamos cookies propias y de terceros para mejorar tu experiencia y analizar el uso del servicio.{' '}
            <Link
              href="/legal/cookies"
              style={{ color: 'var(--orange)', fontWeight: 600, textDecoration: 'none' }}
            >
              Política de cookies
            </Link>
          </p>
        </div>

        {/* Expanded checkboxes */}
        {state === 'expanded' && (
          <div
            style={{
              background: 'var(--warm)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '14px 16px',
              marginBottom: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {/* Necesarias */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'not-allowed',
                fontFamily: "'Cabinet Grotesk', sans-serif",
                fontSize: '0.88rem',
                color: 'var(--muted)',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked
                disabled
                style={{ accentColor: 'var(--orange)', width: '16px', height: '16px', flexShrink: 0 }}
              />
              <span>
                <strong style={{ color: 'var(--ink)' }}>Necesarias</strong>
                {' '}— requeridas para el funcionamiento del servicio
              </span>
            </label>

            {/* Funcionales */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                fontFamily: "'Cabinet Grotesk', sans-serif",
                fontSize: '0.88rem',
                color: 'var(--ink)',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={prefs.functional}
                onChange={(e) => setPrefs((p) => ({ ...p, functional: e.target.checked }))}
                style={{ accentColor: 'var(--orange)', width: '16px', height: '16px', flexShrink: 0 }}
              />
              <span>
                <strong>Funcionales</strong>
                {' '}— recordar preferencias de idioma y tema
              </span>
            </label>

            {/* Analíticas */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                fontFamily: "'Cabinet Grotesk', sans-serif",
                fontSize: '0.88rem',
                color: 'var(--ink)',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={prefs.analytics}
                onChange={(e) => setPrefs((p) => ({ ...p, analytics: e.target.checked }))}
                style={{ accentColor: 'var(--orange)', width: '16px', height: '16px', flexShrink: 0 }}
              />
              <span>
                <strong>Analíticas</strong>
                {' '}— PostHog, para mejorar el producto (no se comparten con terceros)
              </span>
            </label>
          </div>
        )}

        {/* Buttons */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            alignItems: 'center',
          }}
        >
          {state === 'expanded' ? (
            <>
              <button
                onClick={() => saveConsent('custom', prefs)}
                style={btnPrimary}
              >
                Guardar preferencias
              </button>
              <button
                onClick={() => setState('visible')}
                style={btnGhost}
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => saveConsent('all')}
                style={btnPrimary}
              >
                Aceptar todas
              </button>
              <button
                onClick={() => saveConsent('necessary')}
                style={btnOutline}
              >
                Solo necesarias
              </button>
              <button
                onClick={() => setState('expanded')}
                style={btnGhost}
              >
                Personalizar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Button style objects ──────────────────────────────────────────────────── */

const btnBase: React.CSSProperties = {
  fontFamily: "'Cabinet Grotesk', sans-serif",
  fontWeight: 700,
  fontSize: '0.85rem',
  padding: '9px 18px',
  borderRadius: '40px',
  border: 'none',
  cursor: 'pointer',
  transition: 'background 0.2s, color 0.2s',
  whiteSpace: 'nowrap',
  lineHeight: 1.2,
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: 'var(--ink)',
  color: 'var(--cream)',
};

const btnOutline: React.CSSProperties = {
  ...btnBase,
  background: 'transparent',
  color: 'var(--ink)',
  border: '1.5px solid var(--border)',
};

const btnGhost: React.CSSProperties = {
  ...btnBase,
  background: 'transparent',
  color: 'var(--muted)',
  padding: '9px 12px',
};
