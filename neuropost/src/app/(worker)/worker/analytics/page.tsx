'use client';

import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Clock, Users, TrendingUp, DollarSign, AlertTriangle } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";
const C = {
  bg: '#ffffff',
  bg1: '#f3f4f6',
  bg2: '#ecfdf5',
  card: '#ffffff',
  border: '#e5e7eb',
  text: '#111111',
  muted: '#6b7280',
  accent: '#0F766E',
  accent2: '#0D9488',
  red: '#0F766E',
  orange: '#0D9488',
  green: '#0F766E',
};

const PLAN_PRICES: Record<string, number> = { starter: 21, pro: 63, total: 133, agency: 159 };

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB 1: MI-RENDIMIENTO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function MiRendimientoTab() {
  const [metrics, setMetrics] = useState({ totalValidated: 0, approvalRate: 0, avgResponseTimeH: '0', rejected: 0 });

  useEffect(() => {
    fetch('/api/worker/metricas?mine=1').then((r) => r.json()).then(setMetrics);
  }, []);

  return (
    <div style={{ padding: '32px 40px', maxWidth: 800, flex: 1, overflow: 'auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 6 }}>Mi rendimiento</h1>
      <p style={{ color: C.muted, fontSize: 14, marginBottom: 28 }}>Tus estadísticas personales de este mes</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Posts validados este mes', value: metrics.totalValidated, color: C.accent2 },
          { label: 'Tasa de aprobación de clientes', value: `${metrics.approvalRate}%`, color: C.green },
          { label: 'Tiempo medio de respuesta', value: `${metrics.avgResponseTimeH}h`, color: C.orange },
          { label: 'Posts rechazados', value: metrics.rejected, color: C.red },
        ].map((card) => (
          <div key={card.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: '24px 28px' }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>{card.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: C.muted, marginBottom: 16 }}>RESUMEN</h2>
        <p style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>
          Este mes has validado <strong style={{ color: C.accent2 }}>{metrics.totalValidated}</strong> posts con una tasa de aprobación del{' '}
          <strong style={{ color: C.green }}>{metrics.approvalRate}%</strong>.
          Tu tiempo medio de respuesta es de <strong style={{ color: C.orange }}>{metrics.avgResponseTimeH} horas</strong>.
        </p>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB 2: EQUIPO (Metricas)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function EquipoTab() {
  const [metrics, setMetrics] = useState({ totalValidated: 0, approvalRate: 0, avgResponseTimeH: '0', rejected: 0 });
  const [workers, setWorkers] = useState<{ id: string; full_name: string; role: string }[]>([]);

  useEffect(() => {
    fetch('/api/worker/metricas').then((r) => r.json()).then(setMetrics);
    fetch('/api/worker/trabajadores').then((r) => r.json()).then((d) => setWorkers(d.workers ?? []));
  }, []);

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1000, flex: 1, overflow: 'auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 24 }}>Métricas del equipo</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Posts validados', value: metrics.totalValidated },
          { label: 'Tasa aprobación', value: `${metrics.approvalRate}%`, color: C.green },
          { label: 'Tiempo medio', value: `${metrics.avgResponseTimeH}h`, color: C.orange },
          { label: 'Rechazados', value: metrics.rejected, color: C.red },
        ].map((card) => (
          <div key={card.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: 20 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: card.color ?? C.accent2 }}>{card.value}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{card.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 700, color: C.text }}>
          Equipo de trabajadores
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.bg1 }}>
              {['Trabajador', 'Rol', 'Estado'].map((h) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {workers.map((w) => (
              <tr key={w.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '12px 16px', fontSize: 13, color: C.text }}>{w.full_name}</td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: C.muted, textTransform: 'capitalize' }}>{w.role}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.green }}>Activo</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB 3: NEGOCIO (Business) - SOLO ADMIN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function NegocioTab() {
  const [stats, setStats] = useState({
    totalBrands: 0,
    byPlan: { starter: 0, pro: 0, total: 0, agency: 0 },
    mrr: 0,
    arr: 0,
    activeTrials: 0,
    atRisk: 0,
    aiCostMonth: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const sb = createBrowserClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: brands } = await (sb as any).from('brands').select('id, plan, trial_ends_at');
      const list = brands ?? [];

      const byPlan = { starter: 0, pro: 0, total: 0, agency: 0 };
      let activeTrials = 0;
      const now = new Date();
      list.forEach((b: { plan: string; trial_ends_at: string | null }) => {
        if (b.plan && b.plan in byPlan) byPlan[b.plan as keyof typeof byPlan]++;
        if (b.trial_ends_at && new Date(b.trial_ends_at) > now) activeTrials++;
      });

      const mrr = byPlan.starter * PLAN_PRICES.starter +
                  byPlan.pro * PLAN_PRICES.pro +
                  byPlan.total * PLAN_PRICES.total +
                  byPlan.agency * PLAN_PRICES.agency;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count: atRisk } = await (sb as any)
        .from('client_health_scores')
        .select('id', { count: 'exact', head: true })
        .in('risk_level', ['at_risk', 'critical']);

      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count: agentCalls } = await (sb as any)
        .from('agent_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', monthAgo)
        .eq('status', 'success');
      const aiCostMonth = (agentCalls ?? 0) * 0.05;

      setStats({
        totalBrands: list.length,
        byPlan, mrr, arr: mrr * 12, activeTrials,
        atRisk: atRisk ?? 0,
        aiCostMonth,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) return <div style={{ padding: 40, color: C.muted }}>Cargando métricas de negocio...</div>;

  const margin = stats.mrr > 0 ? ((stats.mrr - stats.aiCostMonth) / stats.mrr) * 100 : 0;

  return (
    <div style={{ padding: 28, color: C.text, flex: 1, overflow: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <TrendingUp size={22} style={{ color: C.accent2 }} /> Métricas de negocio
        </h1>
        <p style={{ color: C.muted, fontSize: 13, margin: '4px 0 0' }}>Panel ejecutivo</p>
      </div>

      {/* Top KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        <KpiCard icon={DollarSign} label="MRR" value={`€${stats.mrr.toLocaleString()}`} sub={`ARR €${stats.arr.toLocaleString()}`} color={C.green} />
        <KpiCard icon={Users} label="Clientes activos" value={String(stats.totalBrands)} sub={`${stats.activeTrials} trials`} color={C.accent2} />
        <KpiCard icon={TrendingUp} label="Margen bruto" value={`${margin.toFixed(1)}%`} sub={`Coste IA €${stats.aiCostMonth.toFixed(2)}`} color="#a855f7" />
        <KpiCard icon={AlertTriangle} label="En riesgo" value={String(stats.atRisk)} sub="Health score bajo" color={stats.atRisk > 0 ? C.red : C.green} />
      </div>

      {/* Plans distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 0, marginBottom: 16 }}>Distribución de planes</h3>
          {Object.entries(stats.byPlan).map(([plan, count]) => {
            const revenue = count * PLAN_PRICES[plan as keyof typeof PLAN_PRICES];
            const pct = stats.totalBrands > 0 ? (count / stats.totalBrands) * 100 : 0;
            return (
              <div key={plan} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>{plan}</span>
                  <span style={{ fontSize: 12, color: C.muted }}>
                    {count} clientes · €{revenue}/mes ({pct.toFixed(0)}%)
                  </span>
                </div>
                <div style={{ height: 6, background: C.bg1, borderRadius: 0, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: C.accent2, transition: 'width 0.4s' }} />
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 0, marginBottom: 16 }}>Resumen</h3>
          <Row label="ARPU" value={`€${stats.totalBrands > 0 ? (stats.mrr / stats.totalBrands).toFixed(0) : 0}`} />
          <Row label="LTV (12 meses)" value={`€${stats.totalBrands > 0 ? ((stats.mrr / stats.totalBrands) * 12).toFixed(0) : 0}`} />
          <Row label="Coste IA / cliente" value={`€${stats.totalBrands > 0 ? (stats.aiCostMonth / stats.totalBrands).toFixed(2) : 0}`} />
          <Row label="Trials activos" value={String(stats.activeTrials)} />
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color }: { icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
        <Icon size={16} style={{ color }} />
      </div>
      <p style={{ fontSize: 28, fontWeight: 800, margin: 0, color: C.text }}>{value}</p>
      <p style={{ fontSize: 11, color: C.muted, margin: '4px 0 0' }}>{sub}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 12, color: C.muted }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB 4: COSTES (Provider cost tracking)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type CostKpis = { costToday: number; costMonth: number; costPerClient: number; activeClients: number };
type ProviderRow = { provider: string; calls: number; costMonth: number; avgCostPerCall: number; pctOfTotal: number };
type BrandCostRow = { brand_id: string; name: string; plan: string; revenue: number; cost: number; margin: number };

function CostesTab() {
  const [kpis, setKpis] = useState<CostKpis>({ costToday: 0, costMonth: 0, costPerClient: 0, activeClients: 0 });
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [brands, setBrands] = useState<BrandCostRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/worker/costs/summary').then(r => r.json()).then(d => {
      setKpis(d.kpis ?? kpis);
      setProviders(d.byProvider ?? []);
      setBrands(d.byBrand ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Cargando datos de costes...</div>;

  return (
    <div style={{ padding: 28, overflowY: 'auto', maxHeight: 'calc(100vh - 240px)' }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: C.border, border: `1px solid ${C.border}`, marginBottom: 24 }}>
        {[
          { label: 'Coste hoy', value: `$${kpis.costToday.toFixed(2)}`, sub: '' },
          { label: 'Coste mes', value: `$${kpis.costMonth.toFixed(2)}`, sub: '' },
          { label: 'Coste/cliente', value: `$${kpis.costPerClient.toFixed(2)}/mes`, sub: '' },
          { label: 'Clientes activos', value: String(kpis.activeClients), sub: '' },
        ].map(({ label, value, sub }) => (
          <KpiCard key={label} icon={DollarSign} label={label} value={value} sub={sub} color={C.accent2} />
        ))}
      </div>

      {/* By provider */}
      <h3 style={{ fontFamily: fc, fontSize: 16, fontWeight: 800, textTransform: 'uppercase', marginBottom: 12 }}>Desglose por proveedor</h3>
      <div style={{ border: `1px solid ${C.border}`, marginBottom: 24, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: f }}>
          <thead>
            <tr style={{ background: C.bg1, borderBottom: `1px solid ${C.border}` }}>
              {['Proveedor', 'Llamadas/mes', 'Coste/mes', 'Coste medio', '% del total'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {providers.map(p => (
              <tr key={p.provider} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '10px 16px', fontWeight: 600 }}>{p.provider}</td>
                <td style={{ padding: '10px 16px' }}>{p.calls}</td>
                <td style={{ padding: '10px 16px', fontWeight: 600, color: C.accent2 }}>${p.costMonth.toFixed(2)}</td>
                <td style={{ padding: '10px 16px', color: C.muted }}>${p.avgCostPerCall.toFixed(3)}</td>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: C.bg1 }}>
                      <div style={{ height: 6, background: C.accent2, width: `${p.pctOfTotal}%` }} />
                    </div>
                    <span style={{ fontSize: 11, color: C.muted, minWidth: 36 }}>{p.pctOfTotal}%</span>
                  </div>
                </td>
              </tr>
            ))}
            {providers.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '24px 16px', textAlign: 'center', color: C.muted }}>Sin datos de costes todavía</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* By brand (profitability) */}
      <h3 style={{ fontFamily: fc, fontSize: 16, fontWeight: 800, textTransform: 'uppercase', marginBottom: 12 }}>Rentabilidad por cliente</h3>
      <div style={{ border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: f }}>
          <thead>
            <tr style={{ background: C.bg1, borderBottom: `1px solid ${C.border}` }}>
              {['Cliente', 'Plan', 'Ingresos/mes', 'Coste/mes', 'Margen', ''].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {brands.map(b => (
              <tr key={b.brand_id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '10px 16px', fontWeight: 600 }}>{b.name}</td>
                <td style={{ padding: '10px 16px' }}>{b.plan}</td>
                <td style={{ padding: '10px 16px' }}>{b.revenue > 0 ? `€${b.revenue}` : '—'}</td>
                <td style={{ padding: '10px 16px', color: C.accent2 }}>${b.cost.toFixed(2)}</td>
                <td style={{ padding: '10px 16px', fontWeight: 700, color: b.margin < 20 ? '#dc2626' : b.margin < 50 ? '#d97706' : C.accent2 }}>
                  {b.margin}%
                </td>
                <td style={{ padding: '10px 16px' }}>
                  {b.margin < 20 && <span style={{ fontSize: 10, padding: '2px 6px', background: '#fef2f2', color: '#dc2626', fontWeight: 700 }}>BAJO</span>}
                </td>
              </tr>
            ))}
            {brands.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '24px 16px', textAlign: 'center', color: C.muted }}>Sin datos de costes todavía</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type AnalyticsTab = 'mi-rendimiento' | 'equipo' | 'negocio' | 'costes';
type IconProps = { size?: number; style?: React.CSSProperties };

const ANALYTICS_TABS: { key: AnalyticsTab; title: string; desc: string; icon: React.ComponentType<IconProps> }[] = [
  { key: 'mi-rendimiento', title: 'Mi Rendimiento', desc: 'Mis métricas', icon: Clock },
  { key: 'equipo', title: 'Equipo', desc: 'Equipo', icon: Users },
  { key: 'negocio', title: 'Negocio', desc: 'Negocio', icon: TrendingUp },
  { key: 'costes', title: 'Costes', desc: 'Proveedores IA', icon: DollarSign },
];

export default function AnalyticsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get('tab') as AnalyticsTab) || 'mi-rendimiento';

  function setTab(t: AnalyticsTab) {
    router.push(`/worker/analytics?tab=${t}`);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: C.bg }}>
      {/* Header */}
      <div style={{ padding: '48px 40px 40px', borderBottom: `1px solid ${C.border}` }}>
        <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: C.text, lineHeight: 0.95, marginBottom: 8 }}>
          Analytics
        </h1>
        <p style={{ color: C.muted, fontSize: 15, fontFamily: f }}>Métricas y rendimiento</p>
      </div>

      {/* Tab selector — Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: C.border, border: `1px solid ${C.border}`, margin: '40px', marginBottom: 0 }}>
        {ANALYTICS_TABS.map((s) => {
          const active = tab === s.key;
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              onClick={() => setTab(s.key)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                padding: '28px 20px',
                background: active ? C.accent : C.card,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <Icon size={28} style={{ color: active ? '#ffffff' : C.accent2 }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: fc, fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.06em', color: active ? '#ffffff' : C.text }}>
                  {s.title}
                </div>
                <div style={{ fontSize: 12, color: active ? 'rgba(255,255,255,0.8)' : C.muted, marginTop: 4 }}>
                  {s.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'mi-rendimiento' && <MiRendimientoTab />}
        {tab === 'equipo' && <EquipoTab />}
        {tab === 'negocio' && <NegocioTab />}
        {tab === 'costes' && <CostesTab />}
      </div>
    </div>
  );
}
