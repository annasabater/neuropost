// =============================================================================
// strategy:plan_week
// =============================================================================
// The closest thing to an "agentic" handler in F4:
//   1. Loads brand + resolves post count from PLAN_CONTENT_QUOTAS (Sprint 11)
//   2. Calls generateIdeasForBrand() to get N prioritized ideas
//   3. For each idea, emits sub-jobs to execute it:
//        - content:generate_image     (produces the visual)
//        - content:generate_caption   (produces the copy)
//        - moderation:check_brand_safety (optional gate)
//   4. Returns a strategy output containing the ideas + counts,
//      and sub_jobs that the runner will persist with parent_job_id = this job.
//
// The runner owns persistence, so this handler never touches queueJob() —
// it just returns `sub_jobs` in HandlerResult and the runner fans them out.
//
// Inputs (job.input):
//   { count?: number, format_override?: PostFormat }
//     - count: override post count (useful for tests/debug). If omitted,
//              uses PLAN_CONTENT_QUOTAS[brand.plan].posts_per_week.
//     - format_override: force all ideas to this format
//
// Gotchas:
//   - Video formats are NOT auto-fanned-out in F4. Videos need an explicit
//     plan gate and are billed differently — we produce the idea but leave
//     it pending human trigger (the UI can surface a "generate video" CTA).
//   - We only fan out "alta" + "media" priorities. "baja" ideas are
//     returned for the user to browse but not queued for execution.

import { generateIdeasForBrand }                        from './generate-ideas';
import { loadBrand }                                    from '../helpers';
import { parseIdeasFromStrategyPayload, extractWeekStart } from '@/lib/planning/parse-ideas';
import { createWeeklyPlanFromOutput, transitionWeeklyPlanStatus } from '@/lib/planning/weekly-plan-service';
import { enqueueClientReviewEmail }                     from '@/lib/planning/trigger-client-email';
import { createAdminClient }                            from '@/lib/supabase';
import { PLAN_CONTENT_QUOTAS }                          from '@/lib/plan-limits';
import { planStoriesHandler }                           from '../stories/plan-stories';
import type { AgentJob, HandlerResult, HandlerSubJob }  from '../types';
import type { ContentIdea, PostFormat }                 from './types';
import type { PlanKey }                                 from '@/lib/plan-limits';
import type { BrandMaterial }                           from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

interface PlanWeekInput {
  count?:           number;
  format_override?: PostFormat;
}

function ideaToSubJobs(idea: ContentIdea, brandId: string): HandlerSubJob[] {
  // Priority mapping: idea priority → job priority (0-100)
  const priority = idea.priority === 'alta' ? 80
                 : idea.priority === 'media' ? 55
                 : 30;

  const subJobs: HandlerSubJob[] = [];

  // 1. Generate the caption in parallel with the visual.
  subJobs.push({
    agent_type: 'content',
    action:     'generate_caption',
    priority,
    input: {
      goal:          'engagement',
      topic:         idea.title,
      caption_angle: idea.caption_angle,
      category_key:  idea.category_key,
      platforms:     ['instagram'],
      // The plan_week handler does NOT resolve brand voice here — the
      // copywriter handler loads it from the brand row. Keeps this layer thin.
      brand_id: brandId,
    },
  });

  // 2. Generate the visual. Videos are a deliberate exception: we return
  // the idea but don't auto-fan-out the video job. See header doc.
  if (idea.format !== 'video' && idea.format !== 'reel') {
    subJobs.push({
      agent_type: 'content',
      action:     'generate_image',
      priority,
      input: {
        userPrompt:  idea.asset_hint || idea.title,
        format:      idea.format === 'story' ? 'story' : 'post',
        brandId,    // ImageGenerateAgent uploads to Supabase if present
      },
    });
  }

  return subJobs;
}

export async function planWeekHandler(job: AgentJob): Promise<HandlerResult> {
  if (!job.brand_id) {
    return { type: 'fail', error: 'brand_id is required' };
  }

  const input = job.input as unknown as PlanWeekInput;

  // ── Load brand early so we can derive plan quotas before calling the LLM ──
  const brand = await loadBrand(job.brand_id);

  // Resolve plan — default to 'starter' if unknown
  const rawPlan = brand?.plan as string | undefined;
  const plan    = (rawPlan && rawPlan in PLAN_CONTENT_QUOTAS)
    ? (rawPlan as PlanKey)
    : 'starter';

  if (rawPlan && !(rawPlan in PLAN_CONTENT_QUOTAS)) {
    console.warn(`[plan-week] Unknown plan '${rawPlan}' for brand ${job.brand_id}, defaulting to starter`);
  }

  const planQuota = PLAN_CONTENT_QUOTAS[plan];

  // job.input.count is the debug/test override; otherwise use plan quota; fallback 2
  const postsPerWeek  = planQuota?.posts_per_week ?? 2;
  const inputCount    = input.count !== undefined && input.count !== null
    ? Number(input.count)
    : postsPerWeek;
  const count = Math.min(Math.max(inputCount, 1), 10);

  let ideas: ContentIdea[];
  try {
    ideas = await generateIdeasForBrand(job.brand_id, count);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'NO_TAXONOMY') {
      return {
        type: 'needs_review',
        reason: 'Antes de planificar la semana, ejecuta strategy:build_taxonomy.',
      };
    }
    const transient = /timeout|rate.?limit|overloaded|503|504|ECONN/i.test(msg);
    return transient ? { type: 'retry', error: msg } : { type: 'fail', error: msg };
  }

  // Apply format override if the caller wants everything as, say, reels.
  if (input.format_override) {
    ideas = ideas.map((i) => ({ ...i, format: input.format_override! }));
  }

  const strategyPayload = {
    ideas,
  } as unknown as Record<string, unknown>;

  // ── Feature-flag bifurcation ─────────────────────────────────────────────
  if (brand?.use_new_planning_flow) {
    // NEW FLOW: persist weekly_plans + content_ideas; suppress sub-job fan-out.
    const weekStart   = extractWeekStart();
    const parsedIdeas = parseIdeasFromStrategyPayload(strategyPayload);

    let planId: string;
    try {
      const { plan: weeklyPlan } = await createWeeklyPlanFromOutput({
        brand_id:        job.brand_id,
        agent_output_id: null,     // runner saves the output after this returns
        week_start:      weekStart,
        parent_job_id:   job.id ?? null,
        ideas:           parsedIdeas,
      });
      planId = weeklyPlan.id;

      await transitionWeeklyPlanStatus({ plan_id: planId, to: 'ideas_ready' });

      // ── Sprint 11: generate and insert story content_ideas ──────────────
      const db = createAdminClient() as DB;

      const { data: material } = await db
        .from('brand_material')
        .select('*')
        .eq('brand_id', job.brand_id)
        .eq('active', true);

      // Resolve enabled story templates — prefer brand preference, fallback to all system ones
      let templatesEnabled: string[] =
        brand.content_mix_preferences?.stories_templates_enabled ?? [];
      if (templatesEnabled.length === 0) {
        const { data: sysTpls } = await db
          .from('story_templates')
          .select('id')
          .eq('kind', 'system');
        templatesEnabled = (sysTpls ?? []).map((t: { id: string }) => t.id);
      }

      const storyRows = await planStoriesHandler({
        brand_id:                  job.brand_id,
        week_id:                   planId,
        brand,
        brand_material:            (material ?? []) as BrandMaterial[],
        stories_per_week:          planQuota?.stories_per_week ?? 3,
        stories_templates_enabled: templatesEnabled,
      });

      if (storyRows.length > 0) {
        const { error: storiesErr } = await db.from('content_ideas').insert(storyRows);
        if (storiesErr) {
          // Non-fatal: log but don't fail the whole plan
          console.error('[plan-week] Failed to insert story ideas:', storiesErr.message);
        }
      }
      // ────────────────────────────────────────────────────────────────────

      // Require worker review unless brand explicitly opts out via human_review_config.messages=false
      const requireWorkerReview = brand.human_review_config?.messages !== false;

      if (requireWorkerReview) {
        await db.from('worker_notifications').insert({
          type:     'needs_review',
          message:  `Plan semanal listo para revisar — semana del ${weekStart}`,
          brand_id: job.brand_id,
          read:     false,
          metadata: { plan_id: planId, week_start: weekStart, event: 'weekly_plan.ideas_ready' },
        });
      } else {
        await transitionWeeklyPlanStatus({ plan_id: planId, to: 'client_reviewing' });
        await enqueueClientReviewEmail(planId);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { type: 'fail', error: `[plan-week] weekly_plan persistence failed: ${msg}` };
    }

    return {
      type: 'ok',
      outputs: [{
        kind:    'strategy',
        payload: { ...strategyPayload, plan_id: planId!, week_start: weekStart },
        model:   'claude-haiku-4-5-20251001',
      }],
      sub_jobs: [],   // no fan-out in new flow
    };
  }

  // ── LEGACY FLOW ───────────────────────────────────────────────────────────
  // Only fan out alta + media priorities. Baja ideas are returned but not queued.
  const executable = ideas.filter((i) => i.priority !== 'baja');
  const subJobs: HandlerSubJob[] = executable.flatMap((i) => ideaToSubJobs(i, job.brand_id!));

  return {
    type: 'ok',
    outputs: [{
      kind:    'strategy',
      payload: {
        ...strategyPayload,
        sub_jobs_queued: subJobs.length,
        executed_ideas:  executable.length,
        deferred_ideas:  ideas.length - executable.length,
      },
      model:   'claude-haiku-4-5-20251001',
    }],
    sub_jobs: subJobs,
  };
}
