import { NextResponse } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';
import { PLAN_META } from '@/types';
import type { SubscriptionPlan } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

/**
 * GET /api/worker/costs/summary
 * Returns cost tracking data: KPIs, per-provider breakdown, per-brand profitability.
 * Admin/owner only.
 */
export async function GET() {
  try {
    await requireWorker();
    const db: DB = createAdminClient();

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Parallel queries
    const [todayRes, monthRes, byProviderRes, byBrandRes] = await Promise.all([
      // Cost today
      db.from('provider_costs').select('cost_usd').gte('created_at', todayStart),
      // Cost this month
      db.from('provider_costs').select('cost_usd').gte('created_at', monthStart),
      // Breakdown by provider (this month)
      db.from('provider_costs').select('provider, action, cost_usd, model').gte('created_at', monthStart),
      // Breakdown by brand (this month)
      db.from('provider_costs').select('brand_id, cost_usd').gte('created_at', monthStart),
    ]);

    const todayCosts = (todayRes.data ?? []) as Array<{ cost_usd: number }>;
    const monthCosts = (monthRes.data ?? []) as Array<{ cost_usd: number }>;
    const providerRows = (byProviderRes.data ?? []) as Array<{ provider: string; action: string; cost_usd: number; model: string }>;
    const brandRows = (byBrandRes.data ?? []) as Array<{ brand_id: string; cost_usd: number }>;

    const costToday = todayCosts.reduce((s, r) => s + Number(r.cost_usd), 0);
    const costMonth = monthCosts.reduce((s, r) => s + Number(r.cost_usd), 0);

    // Per-provider aggregation
    const providerMap = new Map<string, { calls: number; cost: number }>();
    for (const r of providerRows) {
      const prev = providerMap.get(r.provider) ?? { calls: 0, cost: 0 };
      providerMap.set(r.provider, { calls: prev.calls + 1, cost: prev.cost + Number(r.cost_usd) });
    }
    const byProvider = Array.from(providerMap.entries())
      .map(([provider, { calls, cost }]) => ({
        provider,
        calls,
        costMonth: Math.round(cost * 100) / 100,
        avgCostPerCall: calls > 0 ? Math.round((cost / calls) * 1000) / 1000 : 0,
        pctOfTotal: costMonth > 0 ? Math.round((cost / costMonth) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.costMonth - a.costMonth);

    // Per-brand cost aggregation
    const brandCostMap = new Map<string, number>();
    for (const r of brandRows) {
      if (!r.brand_id) continue;
      brandCostMap.set(r.brand_id, (brandCostMap.get(r.brand_id) ?? 0) + Number(r.cost_usd));
    }

    // Fetch brand details for profitability
    const brandIds = Array.from(brandCostMap.keys());
    let byBrand: Array<{ brand_id: string; name: string; plan: string; revenue: number; cost: number; margin: number }> = [];

    if (brandIds.length > 0) {
      const { data: brands } = await db
        .from('brands')
        .select('id, name, plan')
        .in('id', brandIds);

      byBrand = (brands ?? []).map((b: { id: string; name: string; plan: string }) => {
        const cost = brandCostMap.get(b.id) ?? 0;
        const planMeta = PLAN_META[b.plan as SubscriptionPlan];
        const revenue = planMeta?.price ?? 0;
        const margin = revenue > 0 ? Math.round(((revenue - cost) / revenue) * 1000) / 10 : 0;
        return {
          brand_id: b.id,
          name: b.name,
          plan: planMeta?.label ?? b.plan,
          revenue,
          cost: Math.round(cost * 100) / 100,
          margin,
        };
      }).sort((a: { cost: number }, b: { cost: number }) => b.cost - a.cost);
    }

    const activeClients = brandIds.length;

    return NextResponse.json({
      kpis: {
        costToday:      Math.round(costToday * 100) / 100,
        costMonth:      Math.round(costMonth * 100) / 100,
        costPerClient:  activeClients > 0 ? Math.round((costMonth / activeClients) * 100) / 100 : 0,
        activeClients,
      },
      byProvider,
      byBrand,
    });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
