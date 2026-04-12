// =============================================================================
// Weekly pipeline — per-brand marketing cycle
// =============================================================================
// Called by /api/cron/monday-brain for each active brand. Queues the
// complete pipeline in order:
//
//   1. analytics:sync_post_metrics   — ingest real Meta data
//   2. analytics:recompute_weights   — recalibrate taxonomy
//   3. analytics:scan_trends         — sector trends (uses shared global)
//   4. strategy:build_taxonomy       — rebuild if doesn't exist
//   5. strategy:plan_week            — ideas + fan-out content
//   6. scheduling:auto_schedule_week — spread posts across the week
//
// Each step is queued as a separate job with ascending scheduled_for offsets
// so the runner processes them in order (step N+1 won't be picked up until
// the runner tick after step N finishes). This is a "poor man's workflow"
// that works because:
//   • The runner runs every minute
//   • Each step takes <45s
//   • Offset spacing of 2 minutes between steps gives safe margin
//
// All steps share a parent_job_id so they're grouped in the UI.

import { queueJob } from '../queue';
import { createAdminClient } from '@/lib/supabase';
import type { AgentJob } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

interface PipelineStep {
  agent_type: string;
  action:     string;
  input:      Record<string, unknown>;
  priority:   number;
  /** Minutes after the pipeline start to schedule this step. */
  offset_min: number;
}

function buildSteps(brandId: string, sector: string | null): PipelineStep[] {
  return [
    // 1. Ingest fresh metrics from Instagram
    { agent_type: 'analytics', action: 'sync_post_metrics',  input: { days: 60 },              priority: 40, offset_min: 0 },
    // 2. Recalculate category weights with new data
    { agent_type: 'analytics', action: 'recompute_weights',  input: {},                         priority: 40, offset_min: 2 },
    // 3. Sector-specific trends (global already ran on Sunday)
    { agent_type: 'analytics', action: 'scan_trends',        input: { sector_key: sector },     priority: 35, offset_min: 4 },
    // 4. Build/refresh taxonomy (no-ops if fresh)
    { agent_type: 'strategy',  action: 'build_taxonomy',     input: {},                         priority: 50, offset_min: 6 },
    // 5. Plan the week → fans out caption + image sub-jobs
    { agent_type: 'strategy',  action: 'plan_week',          input: { count: 5 },               priority: 50, offset_min: 8 },
    // 6. Schedule the materialized posts
    { agent_type: 'scheduling', action: 'auto_schedule_week', input: {},                         priority: 45, offset_min: 12 },
  ];
}

export interface WeeklyPipelineResult {
  brand_id:     string;
  parent_job_id: string;
  steps_queued: number;
}

/**
 * Queue the full weekly pipeline for a single brand.
 * Returns the parent job + count of steps queued.
 */
export async function queueWeeklyPipeline(brandId: string): Promise<WeeklyPipelineResult> {
  const db = createAdminClient() as DB;

  // Load brand sector for the trends step.
  const { data: brand } = await db
    .from('brands')
    .select('sector')
    .eq('id', brandId)
    .maybeSingle();
  const sector = (brand as { sector?: string } | null)?.sector ?? null;

  // Create a parent "pipeline" job for grouping.
  const parent = await queueJob({
    brand_id:     brandId,
    agent_type:   'strategy',
    action:       'intent:weekly_pipeline',
    input:        { _pipeline: 'weekly', sector },
    priority:     45,
    requested_by: 'cron',
  });
  // Immediately finalize the parent — it's a grouping anchor.
  await db.from('agent_jobs').update({
    status: 'done', finished_at: new Date().toISOString(),
  }).eq('id', parent.id);

  const now = Date.now();
  const steps = buildSteps(brandId, sector);

  for (const step of steps) {
    await queueJob({
      brand_id:      brandId,
      agent_type:    step.agent_type as AgentJob['agent_type'],
      action:        step.action,
      input:         step.input,
      priority:      step.priority,
      requested_by:  'cron',
      parent_job_id: parent.id,
      scheduled_for: new Date(now + step.offset_min * 60_000).toISOString(),
    });
  }

  return {
    brand_id:      brandId,
    parent_job_id: parent.id,
    steps_queued:  steps.length,
  };
}
