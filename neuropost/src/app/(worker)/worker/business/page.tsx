'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Users, DollarSign, AlertTriangle } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase';

const C = {
  bg: '#ffffff',
  bg1: '#f5f5f5',
  bg2: '#fafafa',
  card: '#ffffff',
  border: '#E5E7EB',
  text: '#111111',
  muted: '#6B7280',
  accent: '#0F766E',
  accent2: '#3B82F6',
  red: '#EF4444',
  orange: '#F59E0B',
  green: '#14B8A6',
};

const PLAN_PRICES = { starter: 21, pro: 63, total: 133 };

export default function BusinessPage() {
  const [stats, setStats] = useState({
    totalBrands: 0,
    byPlan: { starter: 0, pro: 0, total: 0 },
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

      const byPlan = { starter: 0, pro: 0, total: 0 };
      let activeTrials = 0;
      const now = new Date();
      list.forEach((b: { plan: string; trial_ends_at: string | null }) => {
        if (b.plan && b.plan in byPlan) byPlan[b.plan as keyof typeof byPlan]++;
        if (b.trial_ends_at && new Date(b.trial_ends_at) > now) activeTrials++;
      });

      const mrr = byPlan.starter * PLAN_PRICES.starter +
                  byPlan.pro * PLAN_PRICES.pro +
                  byPlan.total * PLAN_PRICES.total;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count: atRisk } = await (sb as any)
        .from('client_health_scores')
        .select('id', { count: 'exact', head: true })
        .in('risk_level', ['at_risk', 'critical']);

      // Estimated AI cost from agent_logs (last 30 days)
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count: agentCalls } = await (sb as any)
        .from('agent_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', monthAgo)
        .eq('status', 'success');
      const aiCostMonth = (agentCalls ?? 0) * 0.05; // ~5 cents per call estimated

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
    <div style={{ padding: 28, color: C.text }}>
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
