import { NextResponse }                    from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient }               from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

const PERIOD_DAYS = 30;

export async function GET() {
  try {
    await requireWorker();
    const db    = createAdminClient() as DB;
    const since = new Date(Date.now() - PERIOD_DAYS * 86_400_000).toISOString();

    // ── Weekly plans ──────────────────────────────────────────────────────────
    const { data: plans } = await db
      .from('weekly_plans')
      .select('status, auto_approved, sent_to_client_at, client_approved_at, created_at')
      .gte('created_at', since);

    const allPlans = (plans ?? []) as {
      status: string;
      auto_approved: boolean | null;
      sent_to_client_at: string | null;
      client_approved_at: string | null;
      created_at: string;
    }[];

    const by_status: Record<string, number> = {};
    for (const p of allPlans) {
      by_status[p.status] = (by_status[p.status] ?? 0) + 1;
    }

    const autoApprovedCount = allPlans.filter((p) => p.auto_approved).length;
    const autoApprovedRate  = allPlans.length
      ? Math.round((autoApprovedCount / allPlans.length) * 100) / 100
      : 0;

    // avg generated → sent_to_client (hours)
    const generatedToSentSamples = allPlans
      .filter((p) => p.sent_to_client_at)
      .map((p) => (new Date(p.sent_to_client_at!).getTime() - new Date(p.created_at).getTime()) / 3_600_000);

    const avgGeneratedToSentHours = generatedToSentSamples.length
      ? Math.round(
          (generatedToSentSamples.reduce((s, v) => s + v, 0) / generatedToSentSamples.length) * 10,
        ) / 10
      : 0;

    // avg sent_to_client → client_approved (hours)
    const sentToApprovedSamples = allPlans
      .filter((p) => p.sent_to_client_at && p.client_approved_at)
      .map((p) => (new Date(p.client_approved_at!).getTime() - new Date(p.sent_to_client_at!).getTime()) / 3_600_000);

    const avgSentToApprovedHours = sentToApprovedSamples.length
      ? Math.round(
          (sentToApprovedSamples.reduce((s, v) => s + v, 0) / sentToApprovedSamples.length) * 10,
        ) / 10
      : 0;

    // ── Retouch requests ──────────────────────────────────────────────────────
    const { data: retouches } = await db
      .from('retouch_requests')
      .select('status')
      .gte('created_at', since);

    const allRetouches = (retouches ?? []) as { status: string }[];
    const retouchTotal    = allRetouches.length;
    const resolvedCount   = allRetouches.filter((r) => r.status === 'resolved').length;
    const rejectedCount   = allRetouches.filter((r) => r.status === 'rejected').length;
    const rejectionRate   = retouchTotal
      ? Math.round((rejectedCount / retouchTotal) * 100) / 100
      : 0;
    const perPlanAvg = allPlans.length
      ? Math.round((retouchTotal / allPlans.length) * 10) / 10
      : 0;

    return NextResponse.json({
      period_days: PERIOD_DAYS,
      plans: {
        total:               allPlans.length,
        by_status,
        auto_approved_count: autoApprovedCount,
        auto_approved_rate:  autoApprovedRate,
      },
      timings: {
        avg_generated_to_sent_hours: avgGeneratedToSentHours,
        avg_sent_to_approved_hours:  avgSentToApprovedHours,
      },
      retouches: {
        total:           retouchTotal,
        per_plan_avg:    perPlanAvg,
        resolved_count:  resolvedCount,
        rejected_count:  rejectedCount,
        rejection_rate:  rejectionRate,
      },
    });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
