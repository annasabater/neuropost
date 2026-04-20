'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, Check } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

type PromoCodeData = {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  applicablePlans: string[] | null;
};

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

export default function PromoCouponInput({ planId }: { planId: string }) {
  const brand = useAppStore((s) => s.brand);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [validatedCoupon, setValidatedCoupon] = useState<PromoCodeData | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function validateCoupon() {
    if (!code.trim()) {
      setError('Ingresa un código');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/promo-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.toUpperCase(), planId }),
      });

      const data = await res.json();

      if (res.ok) {
        setValidatedCoupon(data.promoCode);
      } else {
        setError(data.error || 'Cupón no válido');
        setValidatedCoupon(null);
      }
    } catch {
      setError('Error al validar cupón');
      setValidatedCoupon(null);
    } finally {
      setLoading(false);
    }
  }

  async function applyCoupon() {
    if (!validatedCoupon || !brand?.id) return;

    setLoading(true);
    try {
      // Si el usuario ya tiene suscripción, aplicar en próxima renovación
      const periodType = brand.plan ? 'next_billing' : 'immediate';

      const res = await fetch('/api/user/apply-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promoCodeId: validatedCoupon.id,
          brandId: brand.id,
          periodType,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setAppliedCoupon(true);
        toast.success(data.message);
        setTimeout(() => {
          setCode('');
          setValidatedCoupon(null);
          setAppliedCoupon(false);
        }, 2000);
      } else {
        setError(data.error || 'Error al aplicar cupón');
      }
    } catch {
      setError('Error al aplicar cupón');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontFamily: fc, fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12, textTransform: 'uppercase' }}>
        Tienes un cupón de descuento?
      </h3>

      {!validatedCoupon ? (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') validateCoupon();
              }}
              placeholder="CODIGO2026"
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px 14px',
                border: `1px solid ${error ? '#dc2626' : '#e5e7eb'}`,
                borderRadius: 0,
                fontFamily: f,
                fontSize: 13,
                color: '#111827',
                outline: 'none',
                background: '#ffffff',
              }}
            />
            <button
              onClick={validateCoupon}
              disabled={!code.trim() || loading}
              style={{
                padding: '10px 20px',
                background: !code.trim() || loading ? '#9ca3af' : '#0F766E',
                color: '#ffffff',
                border: 'none',
                borderRadius: 0,
                fontWeight: 700,
                fontSize: 12,
                cursor: !code.trim() || loading ? 'not-allowed' : 'pointer',
                fontFamily: fc,
                whiteSpace: 'nowrap',
              }}
            >
              {loading ? 'Validando...' : 'Validar'}
            </button>
          </div>

          {error && (
            <p style={{ fontSize: 12, color: '#dc2626', marginTop: 8, fontFamily: f }}>
              ✗ {error}
            </p>
          )}
        </>
      ) : (
        <div style={{ background: '#f0fdfa', border: '1px solid #0D9488', borderRadius: 0, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <p style={{ fontFamily: f, fontSize: 13, color: '#111827', margin: 0, marginBottom: 4 }}>
                Cupón válido:
                <strong style={{ marginLeft: 8 }}>
                  {validatedCoupon.discountType === 'percentage'
                    ? `${validatedCoupon.discountValue}% descuento`
                    : `€${validatedCoupon.discountValue} descuento`}
                </strong>
              </p>
              <p style={{ fontFamily: f, fontSize: 11, color: '#6b7280', margin: 0 }}>
                {brand?.plan
                  ? 'Se aplicará en la próxima renovación'
                  : 'Se aplicará inmediatamente al pagar'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                navigator.clipboard.writeText(validatedCoupon.code);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: '#ffffff',
                border: `1px solid #0D9488`,
                borderRadius: 0,
                color: '#0F766E',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: f,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copiado' : 'Copiar código'}
            </button>

            <button
              onClick={applyCoupon}
              disabled={loading || appliedCoupon}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: appliedCoupon ? '#34d399' : '#0D9488',
                border: 'none',
                borderRadius: 0,
                color: '#ffffff',
                fontWeight: 600,
                fontSize: 12,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: f,
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Aplicando...' : appliedCoupon ? '✓ Aplicado' : 'Aplicar cupón'}
            </button>

            <button
              onClick={() => {
                setValidatedCoupon(null);
                setCode('');
                setError('');
                setAppliedCoupon(false);
              }}
              style={{
                padding: '8px 12px',
                background: '#ffffff',
                border: `1px solid #e5e7eb`,
                borderRadius: 0,
                color: '#6b7280',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: f,
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
