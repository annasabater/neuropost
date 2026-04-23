'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter }                   from 'next/navigation';
import toast                           from 'react-hot-toast';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

interface Props {
  planLabel: string;
  brandName: string;
}

export function BrandKitHeader({ planLabel, brandName }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef         = useRef<HTMLDivElement>(null);
  const router          = useRouter();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function handleExport() {
    setOpen(false);
    toast.success('Exportación en preparación…');
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
      {/* Left: title + subtitle */}
      <div>
        <h1 style={{
          fontFamily:    fc,
          fontWeight:    900,
          fontSize:      '2rem',
          textTransform: 'uppercase',
          letterSpacing: '0.02em',
          color:         '#111827',
          margin:        0,
          lineHeight:    1.1,
        }}>
          Brand kit
        </h1>
        <p style={{
          fontFamily: f,
          fontSize:   14,
          color:      '#6b7280',
          margin:     '4px 0 0',
        }}>
          La identidad que alimenta a tus agentes.
        </p>
      </div>

      {/* Right: plan badge + overflow menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {/* Plan badge */}
        <span style={{
          fontFamily:   f,
          fontSize:     11,
          fontWeight:   600,
          background:   '#f0fdf4',
          color:        '#166534',
          border:       '1px solid #bbf7d0',
          borderRadius: 0,
          padding:      '3px 10px',
          lineHeight:   1.5,
        }}>
          {planLabel}
        </span>

        {/* Overflow menu */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Más opciones"
            style={{
              fontFamily:  f,
              fontSize:    18,
              lineHeight:  1,
              background:  'transparent',
              border:      '1px solid #d4d4d8',
              borderRadius: 0,
              cursor:      'pointer',
              color:       '#111827',
              padding:     '4px 10px',
            }}
          >
            ⋯
          </button>

          {open && (
            <div style={{
              position:   'absolute',
              top:        'calc(100% + 6px)',
              right:      0,
              zIndex:     50,
              background: '#fff',
              border:     '1px solid #d4d4d8',
              borderRadius: 0,
              minWidth:   210,
              boxShadow:  '0 4px 12px rgba(0,0,0,0.08)',
            }}>
              <button
                onClick={() => { setOpen(false); router.push('/onboarding?redo=1'); }}
                style={menuItemStyle}
              >
                Rehacer onboarding
              </button>
              <button
                onClick={handleExport}
                style={{ ...menuItemStyle, borderBottom: 'none' }}
              >
                Exportar configuración
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display:      'block',
  width:        '100%',
  textAlign:    'left',
  background:   'transparent',
  border:       'none',
  borderBottom: '1px solid #f3f4f6',
  cursor:       'pointer',
  padding:      '10px 16px',
  fontSize:     13,
  fontFamily:   "var(--font-barlow), 'Barlow', sans-serif",
  color:        '#111827',
};
