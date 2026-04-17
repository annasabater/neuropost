import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAdminWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';
import { PLAN_META } from '@/types';
import type { SubscriptionPlan } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

const USD_TO_EUR = 0.92;

/**
 * GET /api/worker/finance/summary?period=1m|3m|6m|12m|all
 * Main finance dashboard endpoint. Returns:
 * - KPIs (revenue, expenses, profit, clients)
 * - Monthly revenue/expenses for charts
 * - AI costs by provider
 * - Per-client profitability
 * - MRR breakdown by plan
 * - SaaS metrics (LTV, ARPU, churn)
 * - Alerts
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdminWorker();
    const db: DB = createAdminClient();

    const period = req.nextUrl.searchParams.get('period') ?? '3m';
    const months = period === '1m' ? 1 : period === '3m' ? 3 : period === '6m' ? 6 : period === '12m' ? 12 : 24;
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months, 1).toISOString();
    const prevStartDate = new Date(now.getFullYear(), now.getMonth() - months * 2, 1).toISOString();

    // ── Parallel queries ──────────────────────────────────────────────────
    const [
      aiCostsRes, prevAiCostsRes,
      brandsRes, prevBrandsRes,
      fixedCostsRes,
      aiByProviderRes, aiByBrandRes,
      snapshotsRes,
    ] = await Promise.all([
      // AI costs current period
      db.from('provider_costs').select('cost_usd, provider, action, brand_id, created_at').gte('created_at', startDate),
      // AI costs previous period
      db.from('provider_costs').select('cost_usd').gte('created_at', prevStartDate).lt('created_at', startDate),
      // Active brands
      db.from('brands').select('id, name, plan, subscribed_platforms, created_at'),
      // Brands that existed at start of prev period (for client growth calc)
      db.from('brands').select('id').lt('created_at', startDate),
      // Fixed costs
      db.from('fixed_costs').select('*').eq('active', true),
      // AI costs by provider (current month only for detail)
      db.from('provider_costs').select('provider, action, cost_usd, brand_id')
        .gte('created_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString()),
      // AI costs by brand (current month)
      db.from('provider_costs').select('brand_id, cost_usd')
        .gte('created_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString()),
      // Snapshots
      db.from('monthly_metrics_snapshot').select('*').gte('month', startDate.slice(0, 10)).order('month'),
    ]);

    const aiCosts      = (aiCostsRes.data ?? []) as Array<{ cost_usd: number; provider: string; action: string; brand_id: string; created_at: string }>;
    const prevAiCosts  = (prevAiCostsRes.data ?? []) as Array<{ cost_usd: number }>;
    const brands       = (brandsRes.data ?? []) as Array<{ id: string; name: string; plan: string; subscribed_platforms: string[]; created_at: string }>;
    const prevBrands   = (prevBrandsRes.data ?? []) as Array<{ id: string }>;
    const fixedCosts   = (fixedCostsRes.data ?? []) as Array<{ category: string; name: string; amount_eur: number }>;
    const aiByProvider = (aiByProviderRes.data ?? []) as Array<{ provider: string; action: string; cost_usd: number; brand_id: string }>;
    const aiByBrand    = (aiByBrandRes.data ?? []) as Array<{ brand_id: string; cost_usd: number }>;
    const snapshots    = (snapshotsRes.data ?? []) as Array<{ month: string; plan: string; client_count: number; mrr: number; new_clients: number; churned_clients: number }>;

    // ── KPIs ──────────────────────────────────────────────────────────────

    // Revenue: calculate from brands current state (MRR × months)
    const currentMRR = brands.reduce((sum, b) => {
      const planPrice = PLAN_META[b.plan as SubscriptionPlan]?.price ?? 0;
      const extraNets = Math.max(0, (b.subscribed_platforms?.length ?? 1) - 1);
      return sum + planPrice + extraNets * 15;
    }, 0);
    const estimatedRevenue = currentMRR * months;

    const totalAiCostUSD = aiCosts.reduce((s, c) => s + Number(c.cost_usd), 0);
    const totalAiCostEUR = totalAiCostUSD * USD_TO_EUR;
    const totalFixedMonthly = fixedCosts.reduce((s, c) => s + Number(c.amount_eur), 0);
    const totalFixedPeriod = totalFixedMonthly * months;
    const totalExpenses = totalAiCostEUR + totalFixedPeriod;
    const profit = estimatedRevenue - totalExpenses;
    const margin = estimatedRevenue > 0 ? Math.round((profit / estimatedRevenue) * 1000) / 10 : 0;

    const prevAiTotal = prevAiCosts.reduce((s, c) => s + Number(c.cost_usd), 0) * USD_TO_EUR;
    const expenseChange = prevAiTotal > 0 ? Math.round(((totalAiCostEUR - prevAiTotal) / prevAiTotal) * 100) : 0;

    const activeClients = brands.length;
    const newClientsThisPeriod = brands.filter(b => b.created_at >= startDate).length;
    const clientGrowth = activeClients - prevBrands.length;

    // ── AI costs by provider ──────────────────────────────────────────────
    const providerMap = new Map<string, { calls: number; cost: number }>();
    for (const c of aiByProvider) {
      const prev = providerMap.get(c.provider) ?? { calls: 0, cost: 0 };
      providerMap.set(c.provider, { calls: prev.calls + 1, cost: prev.cost + Number(c.cost_usd) });
    }
    const byProvider = Array.from(providerMap.entries())
      .map(([provider, { calls, cost }]) => ({
        provider,
        calls,
        costUSD: Math.round(cost * 100) / 100,
        costEUR: Math.round(cost * USD_TO_EUR * 100) / 100,
        avgCost: calls > 0 ? Math.round((cost / calls) * 1000) / 1000 : 0,
      }))
      .sort((a, b) => b.costUSD - a.costUSD);

    // ── Per-client profitability ──────────────────────────────────────────
    const brandCostMap = new Map<string, number>();
    for (const c of aiByBrand) {
      if (!c.brand_id) continue;
      brandCostMap.set(c.brand_id, (brandCostMap.get(c.brand_id) ?? 0) + Number(c.cost_usd));
    }

    const byClient = brands
      .map(b => {
        const costUSD = brandCostMap.get(b.id) ?? 0;
        const costEUR = costUSD * USD_TO_EUR;
        const planPrice = PLAN_META[b.plan as SubscriptionPlan]?.price ?? 0;
        const extraNets = Math.max(0, (b.subscribed_platforms?.length ?? 1) - 1);
        const revenue = planPrice + extraNets * 15;
        const clientMargin = revenue > 0 ? Math.round(((revenue - costEUR) / revenue) * 1000) / 10 : 0;
        return { brand_id: b.id, name: b.name, plan: PLAN_META[b.plan as SubscriptionPlan]?.label ?? b.plan, revenue, costEUR: Math.round(costEUR * 100) / 100, margin: clientMargin };
      })
      .sort((a, b) => b.costEUR - a.costEUR);

    // ── MRR by plan ──────────────────────────────────────────────────────
    const planCounts: Record<string, number> = {};
    const planMRR: Record<string, number> = {};
    for (const b of brands) {
      const label = PLAN_META[b.plan as SubscriptionPlan]?.label ?? b.plan;
      planCounts[label] = (planCounts[label] ?? 0) + 1;
      const price = PLAN_META[b.plan as SubscriptionPlan]?.price ?? 0;
      const extra = Math.max(0, (b.subscribed_platforms?.length ?? 1) - 1) * 15;
      planMRR[label] = (planMRR[label] ?? 0) + price + extra;
    }

    // ── Fixed costs breakdown ────────────────────────────────────────────
    const fixedByCategory = new Map<string, number>();
    for (const c of fixedCosts) {
      fixedByCategory.set(c.category, (fixedByCategory.get(c.category) ?? 0) + Number(c.amount_eur));
    }
    // Add AI costs as a category
    const expenseBreakdown = [
      ...Array.from(fixedByCategory.entries()).map(([cat, amount]) => ({ category: cat, amount: Math.round(amount * 100) / 100 })),
      { category: 'apis_ia', amount: Math.round(totalAiCostEUR / months * 100) / 100 },
    ].sort((a, b) => b.amount - a.amount);

    // ── SaaS metrics ─────────────────────────────────────────────────────
    const arpu = activeClients > 0 ? Math.round(currentMRR / activeClients * 100) / 100 : 0;
    const arr = currentMRR * 12;
    const monthlyChurnRate = 0.02; // TODO: calculate from actual data
    const ltv = monthlyChurnRate > 0 ? Math.round(arpu / monthlyChurnRate) : 0;
    const marketingCost = fixedCosts.filter(c => c.category === 'marketing').reduce((s, c) => s + Number(c.amount_eur), 0);
    const cac = newClientsThisPeriod > 0 ? Math.round(marketingCost / newClientsThisPeriod * 100) / 100 : 0;

    // ── Alerts ───────────────────────────────────────────────────────────
    const alerts: Array<{ severity: string; message: string; action?: string }> = [];
    if (margin < 20) alerts.push({ severity: 'warning', message: `Margen bajo: ${margin}%`, action: '/worker/finanzas' });
    if (expenseChange > 15) alerts.push({ severity: 'warning', message: `Costes IA +${expenseChange}% vs período anterior` });
    const unprofitable = byClient.filter(c => c.margin < 0);
    if (unprofitable.length > 0) alerts.push({ severity: 'critical', message: `${unprofitable.length} cliente(s) no rentable(s)` });

    return NextResponse.json({
      kpis: {
        revenue:       Math.round(estimatedRevenue),
        expenses:      Math.round(totalExpenses),
        profit:        Math.round(profit),
        margin,
        activeClients,
        clientGrowth,
        expenseChange,
        mrr:           Math.round(currentMRR),
        arr:           Math.round(arr),
      },
      byProvider,
      byClient: byClient.slice(0, 20),
      planBreakdown: Object.entries(planCounts).map(([label, count]) => ({
        plan: label, clients: count, mrr: planMRR[label] ?? 0,
      })),
      expenseBreakdown,
      saasMetrics: { arpu, ltv, cac, ltvCacRatio: cac > 0 ? Math.round(ltv / cac * 10) / 10 : 0, paybackMonths: arpu > 0 ? Math.round(cac / arpu * 10) / 10 : 0 },
      snapshots,
      alerts,
      fixedCosts: fixedCosts.map(c => ({ id: (c as { id: string }).id, category: c.category, name: c.name, amount: Number(c.amount_eur) })),
      period,
    });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
