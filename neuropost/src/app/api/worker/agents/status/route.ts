import { NextResponse } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

// All registered agent actions grouped by category
const AGENT_REGISTRY: Record<string, { label: string; provider: string; category: string }> = {
  'content:generate_image':          { label: 'ImageGenerateAgent',       provider: 'Replicate (Flux Dev)', category: 'Contenido' },
  'content:generate_video':          { label: 'VideoGenerateAgent',       provider: 'RunwayML Gen-4',       category: 'Contenido' },
  'content:generate_human_photo':    { label: 'HiggsFieldAgent (foto)',   provider: 'Higgsfield AI',        category: 'Contenido' },
  'content:generate_human_video':    { label: 'HiggsFieldAgent (vídeo)',  provider: 'Higgsfield AI',        category: 'Contenido' },
  'content:apply_edit':              { label: 'ImageEditAgent',           provider: 'NanoBanana',           category: 'Contenido' },
  'content:generate_caption':        { label: 'CopywriterAgent',         provider: 'Claude',               category: 'Contenido' },
  'content:generate_ideas':          { label: 'IdeasAgent',              provider: 'Claude',               category: 'Contenido' },
  'content:plan_edit':               { label: 'EditorAgent',             provider: 'Claude',               category: 'Contenido' },
  'content:seasonal_content':        { label: 'SeasonalAgent',           provider: 'Claude',               category: 'Contenido' },
  'content:adapt_trend':             { label: 'TrendsAdaptAgent',        provider: 'Claude',               category: 'Contenido' },
  'content:analyze_inspiration':     { label: 'InspirationAgent',        provider: 'Claude',               category: 'Contenido' },
  'content:extract_creative_recipe': { label: 'CreativeExtractorAgent',  provider: 'Claude',               category: 'Extracción' },
  'strategy:build_taxonomy':         { label: 'TaxonomyBuilder',         provider: 'Claude',               category: 'Estrategia' },
  'strategy:generate_ideas':         { label: 'StrategyIdeasAgent',      provider: 'Claude',               category: 'Estrategia' },
  'strategy:plan_week':              { label: 'WeekPlannerAgent',        provider: 'Claude',               category: 'Estrategia' },
  'content:safe_publish':            { label: 'SafePublishAgent',        provider: 'Claude + Meta API',    category: 'Publicación' },
  'scheduling:auto_schedule_week':   { label: 'AutoScheduleAgent',       provider: 'Internal',             category: 'Publicación' },
  'analytics:analyze_performance':   { label: 'AnalystAgent',            provider: 'Claude',               category: 'Analytics' },
  'analytics:sync_post_metrics':     { label: 'MetricsSyncAgent',        provider: 'Meta API',             category: 'Analytics' },
  'analytics:recompute_weights':     { label: 'WeightRecomputeAgent',    provider: 'Internal',             category: 'Analytics' },
  'analytics:detect_trends':         { label: 'TrendsDetectAgent',       provider: 'Claude',               category: 'Analytics' },
  'analytics:analyze_competitor':    { label: 'CompetitorAgent',         provider: 'Claude',               category: 'Competencia' },
  'support:handle_interactions':     { label: 'CommunityAgent',          provider: 'Claude',               category: 'Soporte' },
  'support:resolve_ticket':          { label: 'SupportAgent',            provider: 'Claude',               category: 'Soporte' },
  'content:validate_image':          { label: 'ImageValidatorAgent',     provider: 'Claude Vision',        category: 'Validación' },
  'content:ab_test_captions':        { label: 'ABTestAgent',             provider: 'Claude',               category: 'Avanzados' },
  'content:repurpose_top_post':      { label: 'RepurposeAgent',          provider: 'Claude',               category: 'Avanzados' },
  'analytics:predict_engagement':    { label: 'PredictEngagementAgent',  provider: 'Claude',               category: 'Avanzados' },
  'growth:churn_risk_scan':          { label: 'ChurnScanAgent',          provider: 'Internal',             category: 'Avanzados' },
  'growth:retention_email':          { label: 'RetentionEmailAgent',     provider: 'Claude',               category: 'Retención' },
  'content:tag_media':               { label: 'MediaTaggerAgent',        provider: 'Claude Vision',        category: 'Media' },
  'moderation:check_brand_safety':   { label: 'BrandSafetyAgent',        provider: 'Claude',               category: 'Moderación' },
};

export async function GET() {
  try {
    await requireWorker();
    const db: DB = createAdminClient();

    // Parallel queries for metrics
    const now = new Date();
    const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const d7  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [pendingRes, runningRes, done24Res, error24Res, done7Res, error7Res, claimedRes] = await Promise.all([
      db.from('agent_jobs').select('agent_type, action', { count: 'exact', head: false }).eq('status', 'pending'),
      db.from('agent_jobs').select('agent_type, action, brand_id, id, input, created_at').eq('status', 'running'),
      db.from('agent_jobs').select('agent_type, action, started_at, finished_at').eq('status', 'done').gte('finished_at', h24),
      db.from('agent_jobs').select('agent_type, action').eq('status', 'error').gte('finished_at', h24),
      db.from('agent_jobs').select('agent_type, action, started_at, finished_at').eq('status', 'done').gte('finished_at', d7),
      db.from('agent_jobs').select('agent_type, action').eq('status', 'error').gte('finished_at', d7),
      db.from('agent_jobs').select('agent_type, action').eq('status', 'claimed'),
    ]);

    const pending  = (pendingRes.data ?? []) as Array<{ agent_type: string; action: string }>;
    const running  = (runningRes.data ?? []) as Array<{ agent_type: string; action: string; brand_id: string; id: string; input: Record<string, unknown>; created_at: string }>;
    const done24   = (done24Res.data ?? []) as Array<{ agent_type: string; action: string; started_at: string; finished_at: string }>;
    const error24  = (error24Res.data ?? []) as Array<{ agent_type: string; action: string }>;
    const done7    = (done7Res.data ?? []) as Array<{ agent_type: string; action: string; started_at: string; finished_at: string }>;
    const error7   = (error7Res.data ?? []) as Array<{ agent_type: string; action: string }>;
    const claimed  = (claimedRes.data ?? []) as Array<{ agent_type: string; action: string }>;

    // Build per-agent metrics
    const agents = Object.entries(AGENT_REGISTRY).map(([key, meta]) => {
      const k = (j: { agent_type: string; action: string }) => `${j.agent_type}:${j.action}` === key;

      const pendingCount  = pending.filter(k).length;
      const runningJobs   = running.filter(k);
      const done24Count   = done24.filter(k).length;
      const error24Count  = error24.filter(k).length;
      const done7Count    = done7.filter(k).length;
      const error7Count   = error7.filter(k).length;
      const claimedCount  = claimed.filter(k).length;

      // Average processing time (24h)
      const times24 = done24.filter(k).map(j => {
        if (!j.started_at || !j.finished_at) return 0;
        return (new Date(j.finished_at).getTime() - new Date(j.started_at).getTime()) / 1000;
      }).filter(t => t > 0);
      const avgTime24 = times24.length > 0 ? times24.reduce((a, b) => a + b, 0) / times24.length : 0;

      // Average processing time (7d)
      const times7 = done7.filter(k).map(j => {
        if (!j.started_at || !j.finished_at) return 0;
        return (new Date(j.finished_at).getTime() - new Date(j.started_at).getTime()) / 1000;
      }).filter(t => t > 0);
      const avgTime7 = times7.length > 0 ? times7.reduce((a, b) => a + b, 0) / times7.length : 0;

      const total24 = done24Count + error24Count;
      const total7  = done7Count + error7Count;

      return {
        key,
        ...meta,
        pending:     pendingCount,
        running:     runningJobs.length,
        runningJobs: runningJobs.map(j => ({ id: j.id, brand_id: j.brand_id, created_at: j.created_at })),
        claimed:     claimedCount,
        done24h:     done24Count,
        error24h:    error24Count,
        successRate24h: total24 > 0 ? Math.round((done24Count / total24) * 1000) / 10 : 100,
        avgTimeS24h: Math.round(avgTime24 * 10) / 10,
        done7d:      done7Count,
        error7d:     error7Count,
        successRate7d: total7 > 0 ? Math.round((done7Count / total7) * 1000) / 10 : 100,
        avgTimeS7d:  Math.round(avgTime7 * 10) / 10,
      };
    });

    // Global KPIs
    const totalDone24   = done24.length;
    const totalError24  = error24.length;
    const totalPending  = pending.length;
    const totalRunning  = running.length;
    const totalClaimed  = claimed.length;
    const globalTotal24 = totalDone24 + totalError24;

    // Alerts
    const alerts: Array<{ severity: string; message: string; agent: string }> = [];
    for (const a of agents) {
      if (a.pending > 10) alerts.push({ severity: 'warning', message: `${a.label} saturado — ${a.pending} jobs en cola`, agent: a.key });
      if (a.error24h >= 3) alerts.push({ severity: 'critical', message: `${a.label} con fallos frecuentes — ${a.error24h} en 24h`, agent: a.key });
      if (a.successRate24h < 90 && (a.done24h + a.error24h) > 5) alerts.push({ severity: 'warning', message: `${a.label} tasa de éxito baja: ${a.successRate24h}%`, agent: a.key });
      for (const rj of a.runningJobs) {
        const elapsed = (now.getTime() - new Date(rj.created_at).getTime()) / 60000;
        if (elapsed > 5) alerts.push({ severity: 'warning', message: `Job ${rj.id.slice(0, 8)} atascado desde hace ${Math.round(elapsed)} min`, agent: a.key });
      }
    }

    return NextResponse.json({
      kpis: {
        jobsToday:     totalDone24,
        successRate:   globalTotal24 > 0 ? Math.round((totalDone24 / globalTotal24) * 1000) / 10 : 100,
        pending:       totalPending,
        running:       totalRunning,
        claimed:       totalClaimed,
        errorsToday:   totalError24,
      },
      agents,
      alerts,
    });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
