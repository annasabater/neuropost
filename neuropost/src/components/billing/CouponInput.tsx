'use client';

import { useEffect, useState } from 'react';

interface CouponInputProps {
  onValidCoupon: (promoCodeId: string, discountText: string) => void;
  onClearCoupon: () => void;
  appliedCode?: string;
}

export default function CouponInput({ onValidCoupon, onClearCoupon, appliedCode }: CouponInputProps) {
  const [code,         setCode]         = useState('');
  const [status,       setStatus]       = useState<'idle' | 'loading' | 'valid' | 'invalid'>('idle');
  const [error,        setError]        = useState('');
  const [discountText, setDiscountText] = useState('');

  // If a code is already applied externally, show it pre-filled as valid
  useEffect(() => {
    if (appliedCode) {
      setCode(appliedCode);
      setStatus('valid');
    }
  }, [appliedCode]);

  async function handleApply() {
    if (!code.trim() || status === 'loading') return;
    setStatus('loading');
    setError('');
    try {
      const res  = await fetch(`/api/stripe/validate-coupon?code=${encodeURIComponent(code.trim())}`);
      const json = await res.json();
      if (res.ok && json.valid) {
        const text = json.discountText ?? '';
        setDiscountText(text);
        setStatus('valid');
        onValidCoupon(json.promoCodeId, text);
      } else {
        setStatus('invalid');
        setError(json.error ?? 'Código no válido o expirado');
      }
    } catch {
      setStatus('invalid');
      setError('Error al validar el código');
    }
  }

  function handleClear() {
    setCode('');
    setStatus('idle');
    setError('');
    setDiscountText('');
    onClearCoupon();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleApply();
  }

  const borderColor =
    status === 'valid'   ? '#14B8A6' :
    status === 'invalid' ? '#ef4444' :
    'var(--border)';

  return (
    <div style={{ marginTop: 8 }}>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8, fontFamily: 'Cabinet Grotesk, sans-serif' }}>
        ¿Tienes un código de descuento?
      </p>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            if (status !== 'idle') { setStatus('idle'); setError(''); }
          }}
          onKeyDown={handleKeyDown}
          placeholder="CODIGO2025"
          disabled={status === 'valid'}
          style={{
            border:      `1px solid ${borderColor}`,
            borderRadius: 8,
            padding:     '10px 14px',
            fontFamily:  'Cabinet Grotesk, sans-serif',
            fontSize:    14,
            width:       '100%',
            outline:     'none',
            transition:  'border-color 0.2s',
            background:  status === 'valid' ? '#f0fdf4' : '#fff',
          }}
        />

        {status === 'valid' ? (
          <button
            type="button"
            onClick={handleClear}
            style={{
              background:  'transparent',
              color:       '#0F766E',
              border:      '1px solid #14B8A6',
              borderRadius: 8,
              padding:     '10px 14px',
              fontWeight:  600,
              cursor:      'pointer',
              fontFamily:  'Cabinet Grotesk, sans-serif',
              fontSize:    13,
              whiteSpace:  'nowrap',
            }}
          >
            ✕ Quitar
          </button>
        ) : (
          <button
            type="button"
            onClick={handleApply}
            disabled={!code.trim() || status === 'loading'}
            style={{
              background:  !code.trim() || status === 'loading' ? '#fdba74' : 'var(--orange)',
              color:       'white',
              border:      'none',
              borderRadius: 8,
              padding:     '10px 20px',
              fontWeight:  700,
              cursor:      !code.trim() || status === 'loading' ? 'not-allowed' : 'pointer',
              fontFamily:  'Cabinet Grotesk, sans-serif',
              fontSize:    14,
              whiteSpace:  'nowrap',
              transition:  'background 0.2s',
            }}
          >
            {status === 'loading' ? '...' : 'Aplicar →'}
          </button>
        )}
      </div>

      {status === 'valid' && (
        <p style={{ fontSize: 13, color: '#0F766E', marginTop: 6, fontFamily: 'Cabinet Grotesk, sans-serif' }}>
          ✓ {discountText || 'Descuento aplicado correctamente'}
        </p>
      )}

      {status === 'invalid' && (
        <p style={{ fontSize: 13, color: '#dc2626', marginTop: 6, fontFamily: 'Cabinet Grotesk, sans-serif' }}>
          ✗ {error || 'Código no válido o expirado'}
        </p>
      )}
    </div>
  );
}
