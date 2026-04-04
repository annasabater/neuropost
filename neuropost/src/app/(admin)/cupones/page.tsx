'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

const A = {
  bg:     '#0f0e0c',
  card:   '#1a1917',
  border: '#2a2927',
  orange: '#ff6b35',
  muted:  '#666',
  text:   '#e8e3db',
  green:  '#4ade80',
  red:    '#f87171',
};

// ── Types ────────────────────────────────────────────────────────────────────

interface PromoCode {
  id: string;
  code: string;
  coupon: {
    percent_off: number | null;
    amount_off: number | null;          // in cents
    duration: 'once' | 'repeating' | 'forever';
    duration_in_months: number | null;
  };
  times_redeemed: number;
  max_redemptions: number | null;
  expires_at: number | null;           // Unix timestamp
  active: boolean;
}

type DurationType = 'once' | 'repeating' | 'forever';
type DiscountType  = 'percent' | 'fixed';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDiscount(pc: PromoCode): string {
  const { percent_off, amount_off } = pc.coupon;
  if (percent_off)  return `${percent_off}% off`;
  if (amount_off)   return `${(amount_off / 100).toFixed(2)}€ off`;
  return '—';
}

function formatDuration(pc: PromoCode): string {
  const { duration, duration_in_months } = pc.coupon;
  if (duration === 'once')       return 'Una vez';
  if (duration === 'forever')    return 'Para siempre';
  if (duration === 'repeating')  return `${duration_in_months ?? '?'} meses`;
  return duration;
}

function formatExpiry(ts: number | null): string {
  if (!ts) return 'Sin fecha';
  return new Date(ts * 1000).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {[140, 80, 90, 70, 90, 70, 80].map((w, i) => (
        <td key={i} style={{ padding: '13px 14px' }}>
          <div style={{ height: 12, width: w, borderRadius: 6, background: A.border, animation: 'pulse 1.4s ease-in-out infinite' }} />
        </td>
      ))}
    </tr>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CuponesPage() {
  // Form state
  const [code,        setCode]        = useState('');
  const [type,        setType]        = useState<DiscountType>('percent');
  const [value,       setValue]       = useState('');
  const [duration,    setDuration]    = useState<DurationType>('once');
  const [months,      setMonths]      = useState('');
  const [maxUses,     setMaxUses]     = useState('');
  const [expiresAt,   setExpiresAt]   = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  // List state
  const [codes,    setCodes]    = useState<PromoCode[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Load coupons
  async function loadCoupons() {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/cupones');
      const data = await res.json() as { promotionCodes: PromoCode[] };
      setCodes(data.promotionCodes ?? []);
    } catch {
      toast.error('Error al cargar los cupones');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCoupons(); }, []);

  // Submit new coupon
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) { toast.error('El código es obligatorio'); return; }
    if (!value)       { toast.error('El valor es obligatorio');  return; }
    if (duration === 'repeating' && !months) { toast.error('Indica los meses'); return; }

    const body: Record<string, unknown> = {
      code: code.trim().toUpperCase(),
      duration,
    };

    if (type === 'percent') {
      body.percentOff = Number(value);
    } else {
      body.amountOff = Number(value);
    }

    if (duration === 'repeating') body.durationInMonths = Number(months);
    if (maxUses)                  body.maxRedemptions   = Number(maxUses);
    if (expiresAt) {
      body.expiresAt = Math.floor(new Date(expiresAt).getTime() / 1000);
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/cupones', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `Error ${res.status}`);
      }

      toast.success('Cupón creado correctamente');
      setCode(''); setType('percent'); setValue(''); setDuration('once');
      setMonths(''); setMaxUses(''); setExpiresAt('');
      await loadCoupons();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear el cupón');
    } finally {
      setSubmitting(false);
    }
  }

  // Deactivate coupon
  async function handleDeactivate(promoCodeId: string, code: string) {
    if (!window.confirm(`¿Desactivar el cupón "${code}"? Esta acción no se puede deshacer.`)) return;

    setDeleting(promoCodeId);
    try {
      const res = await fetch(`/api/admin/cupones?promoCodeId=${promoCodeId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `Error ${res.status}`);
      }
      toast.success('Cupón desactivado');
      await loadCoupons();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al desactivar');
    } finally {
      setDeleting(null);
    }
  }

  // ── Shared input style ────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    background:  A.bg,
    border:      `1px solid ${A.border}`,
    borderRadius: 7,
    color:       A.text,
    fontSize:    13,
    padding:     '8px 12px',
    outline:     'none',
    width:       '100%',
    boxSizing:   'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    color:    A.muted,
    fontWeight: 600,
    marginBottom: 5,
    display:  'block',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  };

  const radioLabel: React.CSSProperties = {
    display:    'flex',
    alignItems: 'center',
    gap:        6,
    fontSize:   13,
    color:      A.text,
    cursor:     'pointer',
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100 }}>
      {/* Page header */}
      <h1 style={{ fontSize: 22, fontWeight: 800, color: A.text, margin: '0 0 6px' }}>
        Cupones de descuento
      </h1>
      <p style={{ color: A.muted, fontSize: 13, margin: '0 0 36px' }}>
        Crea y gestiona cupones de Stripe para tus clientes
      </p>

      {/* ── Section 1: Create coupon ─────────────────────────────────────── */}
      <div style={{ background: A.card, border: `1px solid ${A.border}`, borderRadius: 12, padding: 28, marginBottom: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: A.text, margin: '0 0 22px' }}>
          Crear nuevo cupón
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            {/* Código */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Código</label>
              <input
                type="text"
                required
                placeholder="Ej: PROMO20"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                style={inputStyle}
              />
            </div>

            {/* Tipo */}
            <div>
              <label style={labelStyle}>Tipo</label>
              <div style={{ display: 'flex', gap: 20, marginTop: 4 }}>
                <label style={radioLabel}>
                  <input
                    type="radio"
                    value="percent"
                    checked={type === 'percent'}
                    onChange={() => setType('percent')}
                    style={{ accentColor: A.orange }}
                  />
                  Porcentaje (%)
                </label>
                <label style={radioLabel}>
                  <input
                    type="radio"
                    value="fixed"
                    checked={type === 'fixed'}
                    onChange={() => setType('fixed')}
                    style={{ accentColor: A.orange }}
                  />
                  Cantidad fija (€)
                </label>
              </div>
            </div>

            {/* Valor */}
            <div>
              <label style={labelStyle}>Valor</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  required
                  min={0}
                  step={type === 'percent' ? 1 : 0.01}
                  placeholder={type === 'percent' ? '20' : '9.99'}
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  style={{ ...inputStyle, paddingRight: 34 }}
                />
                <span style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  color: A.muted, fontSize: 13, pointerEvents: 'none',
                }}>
                  {type === 'percent' ? '%' : '€'}
                </span>
              </div>
            </div>

            {/* Duración */}
            <div>
              <label style={labelStyle}>Duración</label>
              <div style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
                {(['once', 'repeating', 'forever'] as DurationType[]).map(d => (
                  <label key={d} style={radioLabel}>
                    <input
                      type="radio"
                      value={d}
                      checked={duration === d}
                      onChange={() => setDuration(d)}
                      style={{ accentColor: A.orange }}
                    />
                    {d === 'once'       ? 'Una vez'     : ''}
                    {d === 'repeating'  ? 'X meses'     : ''}
                    {d === 'forever'    ? 'Para siempre': ''}
                  </label>
                ))}
              </div>
            </div>

            {/* Meses (only when repeating) */}
            {duration === 'repeating' && (
              <div>
                <label style={labelStyle}>Meses</label>
                <input
                  type="number"
                  min={1}
                  placeholder="3"
                  value={months}
                  onChange={e => setMonths(e.target.value)}
                  style={inputStyle}
                />
              </div>
            )}

            {/* Límite de usos */}
            <div>
              <label style={labelStyle}>Límite de usos</label>
              <input
                type="number"
                min={1}
                placeholder="Sin límite"
                value={maxUses}
                onChange={e => setMaxUses(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Fecha expiración */}
            <div>
              <label style={labelStyle}>Fecha expiración</label>
              <input
                type="date"
                placeholder="Sin expiración"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
                style={{ ...inputStyle, colorScheme: 'dark' }}
              />
            </div>

          </div>

          {/* Submit */}
          <div style={{ marginTop: 24 }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                background:    submitting ? A.border : A.orange,
                border:        'none',
                borderRadius:  8,
                color:         submitting ? A.muted : '#fff',
                cursor:        submitting ? 'not-allowed' : 'pointer',
                fontSize:      13,
                fontWeight:    700,
                padding:       '10px 24px',
                transition:    'opacity 0.15s',
                opacity:       submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'Creando...' : 'Crear cupón'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Section 2: Coupons table ──────────────────────────────────────── */}
      <div style={{ background: A.card, border: `1px solid ${A.border}`, borderRadius: 12, padding: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: A.text, margin: '0 0 20px' }}>
          Cupones activos
        </h2>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${A.border}` }}>
                {['Código', 'Descuento', 'Duración', 'Usos', 'Expira', 'Estado', 'Acción'].map(h => (
                  <th key={h} style={{
                    padding:       '8px 14px',
                    textAlign:     'left',
                    fontSize:      11,
                    fontWeight:    700,
                    color:         A.muted,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                    whiteSpace:    'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              )}

              {!loading && codes.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '32px 14px', textAlign: 'center', color: A.muted, fontSize: 13 }}>
                    No hay cupones todavía. Crea el primero arriba.
                  </td>
                </tr>
              )}

              {!loading && codes.map(pc => (
                <tr
                  key={pc.id}
                  style={{ borderBottom: `1px solid ${A.border}` }}
                >
                  {/* Código */}
                  <td style={{ padding: '13px 14px' }}>
                    <span style={{
                      fontFamily:   'monospace',
                      background:   'rgba(255,107,53,0.1)',
                      border:       `1px solid rgba(255,107,53,0.25)`,
                      borderRadius: 5,
                      color:        A.orange,
                      fontSize:     12,
                      fontWeight:   700,
                      padding:      '3px 8px',
                      letterSpacing: 0.5,
                    }}>
                      {pc.code}
                    </span>
                  </td>

                  {/* Descuento */}
                  <td style={{ padding: '13px 14px', color: A.text }}>
                    {formatDiscount(pc)}
                  </td>

                  {/* Duración */}
                  <td style={{ padding: '13px 14px', color: A.text }}>
                    {formatDuration(pc)}
                  </td>

                  {/* Usos */}
                  <td style={{ padding: '13px 14px', color: A.text }}>
                    {pc.times_redeemed} / {pc.max_redemptions ?? '∞'}
                  </td>

                  {/* Expira */}
                  <td style={{ padding: '13px 14px', color: A.muted }}>
                    {formatExpiry(pc.expires_at)}
                  </td>

                  {/* Estado */}
                  <td style={{ padding: '13px 14px' }}>
                    {pc.active
                      ? <span style={{ color: A.green, fontSize: 12, fontWeight: 600 }}>Activo</span>
                      : <span style={{ color: A.red,   fontSize: 12, fontWeight: 600 }}>Inactivo</span>
                    }
                  </td>

                  {/* Acción */}
                  <td style={{ padding: '13px 14px' }}>
                    {pc.active && (
                      <button
                        disabled={deleting === pc.id}
                        onClick={() => handleDeactivate(pc.id, pc.code)}
                        style={{
                          background:   'rgba(248,113,113,0.1)',
                          border:       `1px solid rgba(248,113,113,0.25)`,
                          borderRadius: 6,
                          color:        deleting === pc.id ? A.muted : A.red,
                          cursor:       deleting === pc.id ? 'not-allowed' : 'pointer',
                          fontSize:     12,
                          fontWeight:   600,
                          padding:      '5px 12px',
                          opacity:      deleting === pc.id ? 0.6 : 1,
                          transition:   'opacity 0.15s',
                          whiteSpace:   'nowrap',
                        }}
                      >
                        {deleting === pc.id ? 'Desactivando...' : 'Desactivar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pulse animation for skeleton */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
