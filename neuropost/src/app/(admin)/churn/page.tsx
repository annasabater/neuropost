'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Mail, Gift, Check, ChevronDown, ChevronUp } from 'lucide-react';

const A = { bg: '#0f0e0c', card: '#1a1917', border: '#2a2927', orange: '#ff6b35', muted: '#666', text: '#e8e3db', green: '#4ade80', red: '#f87171', yellow: '#facc15' };

interface BrandRow {
  id: string; name: string; sector: string | null; plan: string;
  churn_score: number; churn_risk: string;
  last_login_at: string | null; last_post_published_at: string | null;
  rejected_in_a_row: number;
}

interface ChurnAction {
  id: string; action_type: string; churn_score_at_action: number; email_subject: string | null; discount_code: string | null; result: string; created_at: string;
}

const RISK_COLOR: Record<string, string> = {
  critical: '#f87171',
  high:     '#ff6b35',
  medium:   '#facc15',
  low:      '#4ade80',
};

const RISK_LABEL: Record<string, string> = {
  critical: '🔴 CRÍTICO',
  high:     '🟠 ALTO',
  medium:   '🟡 MEDIO',
  low:      '🟢 BAJO',
};

function daysSince(iso: string | null): string {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return `${d}d`;
}

export default function ChurnPage() {
  const [brands,    setBrands]    = useState<BrandRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [expanded,  setExpanded]  = useState<string | null>(null);
  const [actions,   setActions]   = useState<Record<string, ChurnAction[]>>({});
  const [generating, setGenerating] = useState<string | null>(null);
  const [emailPreview, setEmailPreview] = useState<{ subject: string; body: string; brandId: string } | null>(null);
  const [discountResult, setDiscountResult] = useState<Record<string, string>>({});
  const [filter,    setFilter]    = useState<string>('all');

  useEffect(() => {
    fetch('/api/admin/churn/brands')
      .then(r => r.json())
      .then((data: { brands: BrandRow[] }) => setBrands(data.brands ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function loadActions(brandId: string) {
    if (actions[brandId]) return;
    const res  = await fetch(`/api/admin/churn/brands/${brandId}/actions`);
    const data = await res.json() as { actions: ChurnAction[] };
    setActions(a => ({ ...a, [brandId]: data.actions ?? [] }));
  }

  async function toggleExpand(brandId: string) {
    if (expanded === brandId) { setExpanded(null); return; }
    setExpanded(brandId);
    await loadActions(brandId);
  }

  async function handleGenerateEmail(brandId: string) {
    setGenerating(brandId);
    const res  = await fetch('/api/agents/churn/email', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ brandId, send: false }),
    });
    const data = await res.json() as { subject: string; body: string };
    setEmailPreview({ ...data, brandId });
    setGenerating(null);
  }

  async function handleSendEmail(brandId: string) {
    await fetch('/api/agents/churn/email', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ brandId, send: true }),
    });
    setEmailPreview(null);
    await loadActions(brandId);
    const res  = await fetch(`/api/admin/churn/brands/${brandId}/actions`);
    const data = await res.json() as { actions: ChurnAction[] };
    setActions(a => ({ ...a, [brandId]: data.actions ?? [] }));
  }

  async function handleDiscount(brandId: string) {
    const res  = await fetch('/api/agents/churn/discount', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ brandId }),
    });
    const data = await res.json() as { code: string };
    setDiscountResult(r => ({ ...r, [brandId]: data.code }));
  }

  const filtered = filter === 'all'
    ? brands
    : brands.filter(b => b.churn_risk === filter);

  const riskCounts = brands.reduce((acc, b) => {
    acc[b.churn_risk] = (acc[b.churn_risk] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div style={{ padding: '32px 40px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: A.text, margin: '0 0 6px' }}>Retención de clientes</h1>
      <p style={{ color: A.muted, fontSize: 13, margin: '0 0 24px' }}>Detecta y actúa sobre clientes en riesgo de cancelar</p>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {(['critical', 'high', 'medium', 'low'] as const).map(risk => (
          <div
            key={risk}
            onClick={() => setFilter(filter === risk ? 'all' : risk)}
            style={{ background: A.card, border: `1px solid ${filter === risk ? RISK_COLOR[risk] : A.border}`, borderRadius: 10, padding: '14px 18px', cursor: 'pointer' }}
          >
            <div style={{ fontSize: 22, fontWeight: 800, color: RISK_COLOR[risk] }}>{riskCounts[risk] ?? 0}</div>
            <div style={{ fontSize: 11, color: A.muted, marginTop: 2 }}>{RISK_LABEL[risk]}</div>
          </div>
        ))}
      </div>

      {/* Brand list */}
      {loading && <div style={{ color: A.muted, fontSize: 13 }}>Cargando clientes...</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered
          .sort((a, b) => b.churn_score - a.churn_score)
          .map(brand => (
          <div key={brand.id} style={{ background: A.card, border: `1px solid ${expanded === brand.id ? 'rgba(255,107,53,0.3)' : A.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <div
              onClick={() => toggleExpand(brand.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', cursor: 'pointer' }}
            >
              {/* Risk badge */}
              <div style={{ minWidth: 80, textAlign: 'center', background: `${RISK_COLOR[brand.churn_risk]}15`, border: `1px solid ${RISK_COLOR[brand.churn_risk]}40`, borderRadius: 6, padding: '3px 8px' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: RISK_COLOR[brand.churn_risk] }}>
                  {RISK_LABEL[brand.churn_risk]}
                </span>
              </div>

              {/* Brand info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: A.text }}>{brand.name}</span>
                <span style={{ fontSize: 11, color: A.muted, marginLeft: 8 }}>{brand.sector ?? ''} · {brand.plan}</span>
              </div>

              {/* Score */}
              <div style={{ textAlign: 'right', marginRight: 12 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: RISK_COLOR[brand.churn_risk] }}>{brand.churn_score}</div>
                <div style={{ fontSize: 10, color: A.muted }}>score</div>
              </div>

              {/* Activity */}
              <div style={{ fontSize: 12, color: A.muted, minWidth: 140 }}>
                Sin login: {daysSince(brand.last_login_at)} · Sin publicar: {daysSince(brand.last_post_published_at)}
              </div>

              {expanded === brand.id ? <ChevronUp size={14} color={A.muted} /> : <ChevronDown size={14} color={A.muted} />}
            </div>

            {/* Expanded actions */}
            {expanded === brand.id && (
              <div style={{ padding: '0 18px 18px', borderTop: `1px solid ${A.border}` }}>
                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button
                    onClick={() => handleGenerateEmail(brand.id)}
                    disabled={generating === brand.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,107,53,0.1)', border: `1px solid rgba(255,107,53,0.3)`, borderRadius: 7, padding: '7px 13px', color: A.orange, fontSize: 12, fontWeight: 600, cursor: generating === brand.id ? 'not-allowed' : 'pointer', opacity: generating === brand.id ? 0.6 : 1 }}
                  >
                    <Mail size={12} /> {generating === brand.id ? 'Generando...' : 'Generar email'}
                  </button>
                  <button
                    onClick={() => handleDiscount(brand.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(74,222,128,0.08)', border: `1px solid rgba(74,222,128,0.2)`, borderRadius: 7, padding: '7px 13px', color: A.green, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    <Gift size={12} /> Ofrecer descuento 50%
                  </button>
                </div>

                {/* Discount code result */}
                {discountResult[brand.id] && (
                  <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(74,222,128,0.08)', border: `1px solid rgba(74,222,128,0.2)`, borderRadius: 7 }}>
                    <span style={{ fontSize: 12, color: A.green }}>✓ Código generado: </span>
                    <strong style={{ fontSize: 13, color: A.green, letterSpacing: 1 }}>{discountResult[brand.id]}</strong>
                  </div>
                )}

                {/* Action history */}
                {(actions[brand.id] ?? []).length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <p style={{ fontSize: 11, color: A.muted, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Historial de acciones</p>
                    {actions[brand.id].map(a => (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${A.border}`, fontSize: 12 }}>
                        <span style={{ color: A.muted, minWidth: 100 }}>{new Date(a.created_at).toLocaleDateString('es-ES')}</span>
                        <span style={{ color: A.text }}>{a.action_type}</span>
                        {a.discount_code && <span style={{ color: A.green }}>🎟 {a.discount_code}</span>}
                        <span style={{ marginLeft: 'auto', color: A.muted }}>{a.result}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Email preview modal */}
      {emailPreview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: A.card, border: `1px solid ${A.border}`, borderRadius: 14, padding: 28, width: 560, maxHeight: '80vh', overflow: 'auto' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: A.text, margin: '0 0 6px' }}>Vista previa del email</h2>
            <p style={{ fontSize: 13, fontWeight: 600, color: A.orange, margin: '0 0 14px' }}>{emailPreview.subject}</p>
            <div
              style={{ fontSize: 13, color: A.text, background: A.bg, borderRadius: 8, padding: 16, maxHeight: 300, overflowY: 'auto', lineHeight: 1.6 }}
              dangerouslySetInnerHTML={{ __html: emailPreview.body }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => setEmailPreview(null)} style={{ flex: 1, background: A.bg, border: `1px solid ${A.border}`, borderRadius: 8, color: A.muted, padding: '9px 0', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button
                onClick={() => handleSendEmail(emailPreview.brandId)}
                style={{ flex: 1, background: A.orange, border: 'none', borderRadius: 8, color: '#fff', padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
              >
                <Check size={13} /> Enviar ahora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
