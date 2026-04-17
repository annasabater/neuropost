'use client';

import { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Users, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend } from 'recharts';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";
const C = { bg: '#ffffff', bg1: '#f3f4f6', border: '#e5e7eb', text: '#111', muted: '#6b7280', accent: '#0F766E', accent2: '#0D9488' };

const PERIODS = [
  { key: '1m', label: '1M' }, { key: '3m', label: '3M' }, { key: '6m', label: '6M' },
  { key: '12m', label: '12M' }, { key: 'all', label: 'Todo' },
] as const;

const PIE_COLORS = ['#0F766E', '#0D9488', '#14b8a6', '#5eead4', '#99f6e4', '#d97706', '#9ca3af'];

type FinanceData = {
  kpis: { revenue: number; expenses: number; profit: number; margin: number; activeClients: number; clientGrowth: number; expenseChange: number; mrr: number; arr: number };
  byProvider: Array<{ provider: string; calls: number; costUSD: number; costEUR: number; avgCost: number }>;
  byClient: Array<{ brand_id: string; name: string; plan: string; revenue: number; costEUR: number; margin: number }>;
  planBreakdown: Array<{ plan: string; clients: number; mrr: number }>;
  expenseBreakdown: Array<{ category: string; amount: number }>;
  saasMetrics: { arpu: number; ltv: number; cac: number; ltvCacRatio: number; paybackMonths: number };
  alerts: Array<{ severity: string; message: string }>;
  fixedCosts: Array<{ id: string; category: string; name: string; amount: number }>;
};

function KpiCard({ label, value, sub, color, icon: Icon }: { label: string; value: string; sub?: string; color: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }) {
  return (
    <div style={{ background: C.bg, padding: '22px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Icon size={16} style={{ color }} />
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, fontFamily: f }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color, fontFamily: fc }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 4, fontFamily: f }}>{sub}</div>}
    </div>
  );
}

const CAT_LABELS: Record<string, string> = {
  nominas: 'Nóminas', infraestructura: 'Infraestructura', marketing: 'Marketing',
  herramientas: 'Herramientas', stripe_fees: 'Stripe Fees', otros: 'Otros', apis_ia: 'APIs e IA',
};

export default function FinanzasPage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [period, setPeriod] = useState('3m');
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/worker/finance/summary?period=${period}`)
      .then(async r => {
        if (r.status === 403) { setForbidden(true); setLoading(false); return; }
        const d = await r.json();
        setData(d); setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [period]);

  if (forbidden) return (
    <div style={{ padding: 60, textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: fc, marginBottom: 8 }}>Acceso restringido</div>
      <div style={{ color: C.muted, fontFamily: f }}>Solo los administradores pueden ver el panel financiero.</div>
    </div>
  );

  if (loading || !data) return <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Cargando panel financiero...</div>;

  const { kpis, byProvider, byClient, planBreakdown, expenseBreakdown, saasMetrics, alerts } = data;

  return (
    <div style={{ padding: '0 40px 60px', maxWidth: 1200, margin: '0 auto', color: C.text }}>
      {/* Header */}
      <div style={{ padding: '40px 0 32px' }}>
        <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', lineHeight: 0.95, marginBottom: 8 }}>
          Panel financiero
        </h1>
        <p style={{ color: C.muted, fontSize: 15, fontFamily: f }}>
          Beneficio: <strong style={{ color: kpis.margin >= 40 ? C.accent : kpis.margin >= 20 ? '#d97706' : '#dc2626' }}>{kpis.profit.toLocaleString('es-ES')} EUR · {kpis.margin}%</strong>
          {' · '}{kpis.clientGrowth >= 0 ? '+' : ''}{kpis.clientGrowth} clientes netos
        </p>
      </div>

      {/* Period selector */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 28 }}>
        {PERIODS.map(({ key, label }) => (
          <button key={key} onClick={() => setPeriod(key)} style={{
            padding: '8px 18px', fontSize: 12, fontWeight: 700, fontFamily: fc,
            background: period === key ? C.accent : C.bg, color: period === key ? '#fff' : C.text,
            border: `1px solid ${period === key ? C.accent : C.border}`,
            borderRight: 'none', cursor: 'pointer',
            ...(key === 'all' ? { borderRight: `1px solid ${period === key ? C.accent : C.border}` } : {}),
          }}>{label}</button>
        ))}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {alerts.map((a, i) => (
            <div key={i} style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontFamily: f, background: a.severity === 'critical' ? '#fef2f2' : '#fffbeb', border: `1px solid ${a.severity === 'critical' ? '#fecaca' : '#fde68a'}` }}>
              <AlertTriangle size={13} style={{ color: a.severity === 'critical' ? '#dc2626' : '#d97706', flexShrink: 0 }} />
              <span>{a.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: C.border, border: `1px solid ${C.border}`, marginBottom: 32 }}>
        <KpiCard label="Ingresos" value={`${kpis.revenue.toLocaleString('es-ES')} EUR`} sub={`MRR: ${kpis.mrr.toLocaleString('es-ES')} EUR`} color={C.accent} icon={TrendingUp} />
        <KpiCard label="Gastos" value={`${kpis.expenses.toLocaleString('es-ES')} EUR`} sub={`${kpis.expenseChange >= 0 ? '+' : ''}${kpis.expenseChange}% vs anterior`} color={kpis.expenseChange > 15 ? '#dc2626' : C.muted} icon={TrendingDown} />
        <KpiCard label="Beneficio" value={`${kpis.margin}%`} sub={`${kpis.profit.toLocaleString('es-ES')} EUR`} color={kpis.margin >= 40 ? C.accent : kpis.margin >= 20 ? '#d97706' : '#dc2626'} icon={DollarSign} />
        <KpiCard label="Clientes" value={String(kpis.activeClients)} sub={`${kpis.clientGrowth >= 0 ? '+' : ''}${kpis.clientGrowth} netos`} color={C.accent2} icon={Users} />
      </div>

      {/* Charts row 1: Expense breakdown + Plan breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
        {/* Expense Breakdown Pie */}
        <div style={{ border: `1px solid ${C.border}`, background: C.bg }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
            <h3 style={{ fontFamily: fc, fontSize: 14, fontWeight: 800, textTransform: 'uppercase', margin: 0 }}>Desglose de gastos</h3>
          </div>
          <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie data={expenseBreakdown} dataKey="amount" nameKey="category" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {expenseBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: unknown) => `${Number(v).toFixed(0)} EUR/mes`} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1 }}>
              {expenseBreakdown.map((e, i) => (
                <div key={e.category} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12, fontFamily: f }}>
                  <div style={{ width: 10, height: 10, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{CAT_LABELS[e.category] ?? e.category}</span>
                  <span style={{ fontWeight: 600 }}>{e.amount.toFixed(0)} EUR</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Plan Breakdown */}
        <div style={{ border: `1px solid ${C.border}`, background: C.bg }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
            <h3 style={{ fontFamily: fc, fontSize: 14, fontWeight: 800, textTransform: 'uppercase', margin: 0 }}>Suscripciones por plan</h3>
          </div>
          <div style={{ padding: 20 }}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={planBreakdown} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="plan" type="category" width={100} tick={{ fontSize: 12, fontFamily: f }} />
                <Tooltip formatter={(v: unknown, name: unknown) => [name === 'clients' ? `${Number(v)} clientes` : `${Number(v)} EUR`, name === 'clients' ? 'Clientes' : 'MRR']} />
                <Bar dataKey="clients" fill={C.accent2} name="Clientes" />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 12, fontFamily: f }}>
              {planBreakdown.map(p => (
                <span key={p.plan}><strong>{p.plan}</strong>: {p.clients} · {p.mrr} EUR MRR</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* AI Costs by Provider */}
      <div style={{ border: `1px solid ${C.border}`, background: C.bg, marginBottom: 32 }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ fontFamily: fc, fontSize: 14, fontWeight: 800, textTransform: 'uppercase', margin: 0 }}>Costes de IA por proveedor</h3>
        </div>
        <div style={{ padding: 20 }}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byProvider}>
              <XAxis dataKey="provider" tick={{ fontSize: 11, fontFamily: f }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: unknown) => `$${Number(v).toFixed(2)}`} />
              <Bar dataKey="costUSD" fill={C.accent2} name="Coste USD" />
            </BarChart>
          </ResponsiveContainer>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: f, marginTop: 16 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['Proveedor', 'Llamadas', 'Coste USD', 'Coste EUR', 'Media/llamada'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byProvider.map(p => (
                <tr key={p.provider} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{p.provider}</td>
                  <td style={{ padding: '8px 12px' }}>{p.calls}</td>
                  <td style={{ padding: '8px 12px', color: C.accent2, fontWeight: 600 }}>${p.costUSD.toFixed(2)}</td>
                  <td style={{ padding: '8px 12px' }}>{p.costEUR.toFixed(2)} EUR</td>
                  <td style={{ padding: '8px 12px', color: C.muted }}>${p.avgCost.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Client Profitability */}
      <div style={{ border: `1px solid ${C.border}`, background: C.bg, marginBottom: 32 }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ fontFamily: fc, fontSize: 14, fontWeight: 800, textTransform: 'uppercase', margin: 0 }}>Rentabilidad por cliente</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: f }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.bg1 }}>
              {['Cliente', 'Plan', 'Ingresos/mes', 'Coste IA/mes', 'Margen', ''].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {byClient.slice(0, 15).map(c => (
              <tr key={c.brand_id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '10px 16px', fontWeight: 600 }}>{c.name}</td>
                <td style={{ padding: '10px 16px' }}>{c.plan}</td>
                <td style={{ padding: '10px 16px' }}>{c.revenue} EUR</td>
                <td style={{ padding: '10px 16px', color: C.accent2 }}>{c.costEUR} EUR</td>
                <td style={{ padding: '10px 16px', fontWeight: 700, color: c.margin < 0 ? '#dc2626' : c.margin < 20 ? '#d97706' : C.accent }}>{c.margin}%</td>
                <td style={{ padding: '10px 16px' }}>{c.margin < 0 && <span style={{ fontSize: 10, padding: '2px 6px', background: '#fef2f2', color: '#dc2626', fontWeight: 700 }}>NO RENTABLE</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* SaaS Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1px', background: C.border, border: `1px solid ${C.border}`, marginBottom: 32 }}>
        {[
          { label: 'MRR', value: `${kpis.mrr.toLocaleString('es-ES')} EUR` },
          { label: 'ARR', value: `${kpis.arr.toLocaleString('es-ES')} EUR` },
          { label: 'ARPU', value: `${saasMetrics.arpu} EUR` },
          { label: 'LTV', value: `${saasMetrics.ltv.toLocaleString('es-ES')} EUR` },
          { label: 'LTV/CAC', value: saasMetrics.cac > 0 ? `${saasMetrics.ltvCacRatio}x` : '—', color: saasMetrics.ltvCacRatio >= 3 ? C.accent : saasMetrics.ltvCacRatio >= 1 ? '#d97706' : '#dc2626' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: C.bg, padding: '18px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: color ?? C.accent2, fontFamily: fc }}>{value}</div>
            <div style={{ fontSize: 9, color: C.muted, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: f }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Additional SaaS metrics row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: C.border, border: `1px solid ${C.border}` }}>
        {[
          { label: 'CAC', value: saasMetrics.cac > 0 ? `${saasMetrics.cac} EUR` : '—' },
          { label: 'Payback', value: saasMetrics.paybackMonths > 0 ? `${saasMetrics.paybackMonths} meses` : '—' },
          { label: 'Gross Margin', value: `${kpis.margin}%` },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: C.bg, padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: fc }}>{value}</div>
            <div style={{ fontSize: 9, color: C.muted, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: f }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
