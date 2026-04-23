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
import { createWeeklyPlanFromOutput, transitionWeeklyPlanStatus, ConcurrentPlanModificationError } from '@/lib/planning/weekly-plan-service';
import { enqueueClientReviewEmail }                     from '@/lib/planning/trigger-client-email';
import { log }                                          from '@/lib/logger';
import { createAdminClient }                            from '@/lib/supabase';
import { PLAN_CONTENT_QUOTAS }                          from '@/lib/plan-limits';
import { getHumanReviewDefaults, resolveHumanReviewConfig } from '@/lib/human-review';
import { routeIdea }                                       from '@/lib/idea-dispatch';
import { planStoriesHandler }                           from '../stories/plan-stories';
import type { AgentJob, HandlerResult, HandlerSubJob }  from '../types';
import type { ContentIdea, PostFormat }                 from './types';
import type { PlanKey }                                 from '@/lib/plan-limits';
import type { BrandMaterial }                           from '@/types';
import { normalizeMaterial }                            from '@/lib/brand-material/normalize';

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
    ({ ideas } = await generateIdeasForBrand(job.brand_id, count));
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
        .select('id, brand_id, category, content, active, valid_until, active_from, active_to, priority, platforms, tags, display_order, created_at, updated_at')
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

      // P10: fail loudly when no templates are available. All plans in
      // PLAN_CONTENT_QUOTAS have stories_per_week ≥ 3, so an empty
      // templatesEnabled list is always a configuration error, not a
      // feature flag. Stories inserted with template_id=null would silently
      // 422 at render time; this surfaces the issue at generation time.
      if (templatesEnabled.length === 0) {
        log({
          level:    'error',
          scope:    'plan-week',
          event:    'no_story_templates_available',
          brand_id: job.brand_id,
        });
        return {
          type:  'fail',
          error: 'NO_STORY_TEMPLATES: no hay templates disponibles para stories. Contacta con soporte para configurar templates del sistema o del brand.',
        };
      }

      const [{ data: inspirationRefs }, { data: mediaRefs }] = await Promise.all([
        db
          .from('inspiration_references')
          .select('id, thumbnail_url')
          .eq('brand_id', job.brand_id)
          .eq('is_saved', true)
          .not('thumbnail_url', 'is', null),
        db
          .from('media_library')
          .select('url')
          .eq('brand_id', job.brand_id)
          .eq('type', 'image'),
      ]);

      const storyRows = await planStoriesHandler({
        brand_id:                  job.brand_id,
        week_id:                   planId,
        brand,
        brand_material:            (material ?? []).map((m: BrandMaterial) => normalizeMaterial(m)),
        stories_per_week:          planQuota?.stories_per_week ?? 3,
        stories_templates_enabled: templatesEnabled,
        startPosition:             parsedIdeas.length,
        inspiration_refs:          inspirationRefs ?? [],
        media_refs:                (mediaRefs ?? []) as { url: string }[],
      });

      if (storyRows.length > 0) {
        const { data: insertedStories, error: storiesErr } = await db
          .from('content_ideas')
          .insert(storyRows)
          .select('id');
        if (storiesErr) {
          // P5: fatal — a plan with missing stories is incomplete
          log({ level: 'error', scope: 'plan-week', event: 'stories_insert_failed',
                plan_id: planId, error: storiesErr.message });
          return { type: 'fail', error: `Failed to insert story ideas: ${storiesErr.message}` };
        }
        if (insertedStories?.length) {
          // P1: mark stories pending_render before dispatching (idempotent if render endpoint re-runs)
          await db
            .from('content_ideas')
            .update({ render_status: 'pending_render' })
            .in('id', (insertedStories as { id: string }[]).map(s => s.id));

          // Fire-and-forget — render endpoint owns the render_status lifecycle
          const baseUrl     = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
          const renderToken = process.env.INTERNAL_RENDER_TOKEN;
          const renderFetches = (insertedStories as { id: string }[]).map(s =>
            fetch(`${baseUrl}/api/render/story/${s.id}`, {
              method:  'POST',
              headers: {
                'Content-Type':  'application/json',
                ...(renderToken ? { 'Authorization': `Bearer ${renderToken}` } : {}),
              },
            }).catch(e => log({ level: 'warn', scope: 'plan-week', event: 'render_trigger_failed',
                                idea_id: s.id, error: String(e) })),
          );
          Promise.allSettled(renderFetches).catch(() => {});
        }
      }
      // ────────────────────────────────────────────────────────────────────

      // Resolve effective human-review config (defaults + brand diff
      // override) and delegate the routing decision to the central
      // dispatcher. For a weekly plan event the other RoutableIdea
      // fields are irrelevant (routeIdea short-circuits), so a neutral
      // placeholder keeps the signature uniform with future
      // individual-idea call-sites.
      const hrDefaults  = await getHumanReviewDefaults(db);
      const hrEffective = resolveHumanReviewConfig(brand.human_review_config ?? null, hrDefaults);
      const decision    = routeIdea(
        {
          content_kind:        'post',
          format:              'image',
          suggested_asset_url: null,
          rendered_image_url:  null,
        },
        hrEffective,
        { is_weekly_plan_event: true, is_regeneration: false },
      );

      if (decision.route === 'worker_review') {
        // P2: check insert result and persist worker_notify_status
        const { error: notifErr } = await db.from('worker_notifications').insert({
          type:     'needs_review',
          message:  `Plan semanal listo para revisar — semana del ${weekStart}`,
          brand_id: job.brand_id,
          read:     false,
          metadata: {
            plan_id:        planId,
            week_start:     weekStart,
            event:          'weekly_plan.ideas_ready',
            routing_reason: {
              flag_checked:    decision.flag_checked,
              effective_value: decision.effective_value,
              reason:          decision.reason,
            },
          },
        });
        const notifyStatus = notifErr ? 'failed' : 'sent';
        if (notifErr) {
          log({ level: 'error', scope: 'plan-week', event: 'worker_notification_failed',
                plan_id: planId, error: notifErr.message });
        } else {
          log({ level: 'info', scope: 'plan-week', event: 'worker_notification_sent', plan_id: planId });
        }
        await db.from('weekly_plans')
          .update({ worker_notify_status: notifyStatus })
          .eq('id', planId);
      } else {
        await transitionWeeklyPlanStatus({ plan_id: planId, to: 'client_reviewing' });
        // P3: use EmailResult to detect and log failures; DB status updated inside enqueueClientReviewEmail
        const emailResult = await enqueueClientReviewEmail(planId);
        if (!emailResult.ok) {
          log({ level: 'error', scope: 'plan-week', event: 'client_review_email_failed',
                plan_id: planId, error: emailResult.error });
        }
      }
    } catch (err) {
      if (err instanceof ConcurrentPlanModificationError) {
        log({ level: 'warn', scope: 'plan-week', event: 'concurrent_modification',
              plan_id: err.planId, expected: err.expected, actual: err.actual });
        return { type: 'fail', error: 'concurrent_modification_during_plan_generation' };
      }
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
