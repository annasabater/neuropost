// =============================================================================
// strategy:plan_week
// =============================================================================
// The closest thing to an "agentic" handler in F4:
//   1. Calls generateIdeasForBrand() to get N prioritized ideas
//   2. For each idea, emits sub-jobs to execute it:
//        - content:generate_image     (produces the visual)
//        - content:generate_caption   (produces the copy)
//        - moderation:check_brand_safety (optional gate)
//   3. Returns a strategy output containing the ideas + counts,
//      and sub_jobs that the runner will persist with parent_job_id = this job.
//
// The runner owns persistence, so this handler never touches queueJob() —
// it just returns `sub_jobs` in HandlerResult and the runner fans them out.
//
// Inputs (job.input):
//   { count?: number, format_override?: PostFormat }
//     - count: number of ideas to plan (default 5, max 10)
//     - format_override: force all ideas to this format
//
// Gotchas:
//   - Video formats are NOT auto-fanned-out in F4. Videos need an explicit
//     plan gate and are billed differently — we produce the idea but leave
//     it pending human trigger (the UI can surface a "generate video" CTA).
//   - We only fan out "alta" + "media" priorities. "baja" ideas are
//     returned for the user to browse but not queued for execution.

import { generateIdeasForBrand } from './generate-ideas';
import type { AgentJob, HandlerResult, HandlerSubJob } from '../types';
import type { ContentIdea, PostFormat } from './types';

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
  const count = Math.min(Math.max(Number(input.count ?? 5), 1), 10);

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

  // Only fan out alta + media priorities. Baja ideas are returned but not queued.
  const executable = ideas.filter((i) => i.priority !== 'baja');
  const subJobs: HandlerSubJob[] = executable.flatMap((i) => ideaToSubJobs(i, job.brand_id!));

  return {
    type: 'ok',
    outputs: [{
      kind:    'strategy',
      payload: {
        ideas,
        sub_jobs_queued: subJobs.length,
        executed_ideas:  executable.length,
        deferred_ideas:  ideas.length - executable.length,
      } as unknown as Record<string, unknown>,
      model:   'claude-haiku-4-5-20251001',
    }],
    sub_jobs: subJobs,
  };
}
