// =============================================================================
// Onboarding pipeline — new brand bootstrapping
// =============================================================================
// Triggered when a brand completes registration/onboarding. Immediately
// gives the new user a working content plan without waiting for Monday.
//
// Pipeline:
//   1. strategy:build_taxonomy   — LLM generates the content tree
//   2. strategy:generate_ideas   — 10 ideas based on taxonomy + trends
//   3. strategy:plan_week        — fan-out content generation
//
// Unlike the weekly pipeline, onboarding does NOT run analytics (no data
// yet) or scheduling (posts will be created as 'pending' for the user to
// review first).
//
// The pipeline also tries to inject existing sector trends from the
// shared `trends` table so the new user benefits from intelligence
// already gathered for their sector.

import { queueJob } from '../queue';
import { createAdminClient } from '@/lib/supabase';
import type { AgentJob } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export interface OnboardingResult {
  brand_id:      string;
  parent_job_id: string;
  steps_queued:  number;
}

export async function queueOnboardingPipeline(brandId: string): Promise<OnboardingResult> {
  const db = createAdminClient() as DB;

  // Create parent job for grouping.
  const parent = await queueJob({
    brand_id:     brandId,
    agent_type:   'strategy',
    action:       'intent:onboarding',
    input:        { _pipeline: 'onboarding' },
    priority:     80, // high — new user is waiting
    requested_by: 'cron',
  });
  await db.from('agent_jobs').update({
    status: 'done', finished_at: new Date().toISOString(),
  }).eq('id', parent.id);

  const now = Date.now();

  // 1. Build taxonomy (immediate)
  await queueJob({
    brand_id: brandId, agent_type: 'strategy', action: 'build_taxonomy',
    input: {}, priority: 80, requested_by: 'cron', parent_job_id: parent.id,
    scheduled_for: new Date(now).toISOString(),
  });

  // 2. Generate ideas (after taxonomy settles)
  await queueJob({
    brand_id: brandId, agent_type: 'strategy', action: 'generate_ideas',
    input: { count: 10 }, priority: 75, requested_by: 'cron', parent_job_id: parent.id,
    scheduled_for: new Date(now + 3 * 60_000).toISOString(),
  });

  // 3. Plan week with 3 starter posts (gives user immediate value)
  await queueJob({
    brand_id: brandId, agent_type: 'strategy', action: 'plan_week',
    input: { count: 3 }, priority: 70, requested_by: 'cron', parent_job_id: parent.id,
    scheduled_for: new Date(now + 6 * 60_000).toISOString(),
  });

  return {
    brand_id:      brandId,
    parent_job_id: parent.id,
    steps_queued:  3,
  };
}
