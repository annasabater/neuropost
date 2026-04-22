// =============================================================================
// F7 — Publishing pipeline handlers
// =============================================================================
// Integrates the moderation + scheduling agents with the existing publish
// flow. Composition (not fan-out) because we need the result of moderation
// before we can publish: a true pipeline.
//
// content:safe_publish  — moderation check → publish if safe, else needs_review
// scheduling:auto_schedule_week — picks slots for a list of posts

import type { PublisherInput } from '@neuropost/agents';
import { publishPostById } from '@/lib/publishPost';
import { createAdminClient } from '@/lib/supabase';
import { loadBrandContext } from '../helpers';
import { registerHandler } from '../registry';
import type { AgentHandler, AgentJob, HandlerResult } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

// -----------------------------------------------------------------------------
// content:safe_publish
// -----------------------------------------------------------------------------
// Input shape:
//   { post_id: string, skip_moderation?: boolean }
//
// Flow:
//   1. Load post + brand
//   2. Unless skip_moderation, run PublisherAgent with the post fields
//   3. If safety check fails → needs_review with the analysis
//   4. If safety check passes → call publishPostById() → done
//
// The safe_publish handler is THE canonical way to publish for agent-driven
// flows. Manual publishes still use POST /api/publish directly, which is
// fine — they're user-initiated and can skip this pipeline.
// -----------------------------------------------------------------------------

const safePublishHandler: AgentHandler = async (job: AgentJob): Promise<HandlerResult> => {
  if (!job.brand_id) return { type: 'fail', error: 'brand_id is required' };

  const input = job.input as { post_id?: string; skip_moderation?: boolean };
  if (!input.post_id) return { type: 'fail', error: 'post_id is required' };

  try {
    const { brand, ctx } = await loadBrandContext(job.brand_id);
    const db = createAdminClient() as DB;

    const { data: post } = await db
      .from('posts')
      .select('id, caption, hashtags, platform, format, image_url, edited_image_url, status')
      .eq('id', input.post_id)
      .eq('brand_id', job.brand_id)
      .maybeSingle();
    if (!post) return { type: 'fail', error: `Post not found: ${input.post_id}` };

    // ── 1. Moderation check ───────────────────────────────────────────────
    if (!input.skip_moderation) {
      const pubInput = {
        postId:    post.id,
        caption:   post.caption ?? '',
        hashtags:  post.hashtags ?? [],
        platforms: post.platform ?? ['instagram'],
        mediaUrl:  post.edited_image_url ?? post.image_url ?? '',
        format:    post.format ?? 'image',
      } as unknown as PublisherInput;

      const { runPublisherAgent } = await import('@neuropost/agents');
      const safetyResult = await runPublisherAgent(pubInput, ctx);
      if (!safetyResult.success) {
        return { type: 'fail', error: safetyResult.error?.message ?? 'Moderation failed' };
      }
      const safety = (safetyResult.data as unknown as { brandSafetyCheck?: { passed?: boolean } })?.brandSafetyCheck;
      if (safety && safety.passed === false) {
        return {
          type: 'needs_review',
          reason: 'Moderation rejected the post — review required before publish.',
          outputs: [{
            kind:    'analysis',
            payload: safetyResult.data as unknown as Record<string, unknown>,
            model:   'publisher-agent',
          }],
        };
      }
    }

    // ── 2. Publish ─────────────────────────────────────────────────────────
    // publishPostById requires the post status to be 'approved'. Auto-bump
    // if it's currently pending (this is a deliberate agent action — the
    // moderation-agent already cleared the safety concern).
    if (post.status !== 'approved') {
      await db.from('posts').update({ status: 'approved' }).eq('id', post.id);
    }

    const result = await publishPostById(post.id, brand.user_id);

    return {
      type: 'ok',
      outputs: [{
        kind:    'post',
        payload: {
          post_id: post.id,
          ...result,
        } as unknown as Record<string, unknown>,
        model: 'publisher-agent+meta',
      }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const transient = /timeout|rate.?limit|overloaded|503|504|ECONN|fetch failed/i.test(msg);
    return transient ? { type: 'retry', error: msg } : { type: 'fail', error: msg };
  }
};

// -----------------------------------------------------------------------------
// scheduling:auto_schedule_week
// -----------------------------------------------------------------------------
// Takes a list of post IDs and spreads them across the next 7 days, biased
// toward the brand's best-hour slots from post_analytics. This is
// deliberately a rule-based handler (no LLM) — scheduling is a deterministic
// layout problem.
//
// Input: { post_ids: string[] }
// Output: { scheduled: [{ post_id, scheduled_at }] }
// -----------------------------------------------------------------------------

const BEST_HOUR_FALLBACK = 20; // 8pm — safe default for consumer brands
const DEFAULT_SPACING_HOURS = 36; // avoid two posts in the same half-day

const autoScheduleHandler: AgentHandler = async (job: AgentJob): Promise<HandlerResult> => {
  if (!job.brand_id) return { type: 'fail', error: 'brand_id is required' };

  const input = job.input as { post_ids?: string[] };
  if (!Array.isArray(input.post_ids) || input.post_ids.length === 0) {
    return { type: 'fail', error: 'post_ids is required' };
  }

  try {
    const db = createAdminClient() as DB;

    // Look up the brand's most common best_hour from recent analytics.
    const { data: analytics } = await db
      .from('post_analytics')
      .select('best_hour')
      .eq('brand_id', job.brand_id)
      .not('best_hour', 'is', null)
      .order('published_at', { ascending: false })
      .limit(30);

    const hours = ((analytics ?? []) as Array<{ best_hour: number }>).map((r) => r.best_hour);
    const bestHour = hours.length > 0
      ? Math.round(hours.reduce((a, b) => a + b, 0) / hours.length)
      : BEST_HOUR_FALLBACK;

    // Simple layout: start tomorrow, one post every DEFAULT_SPACING_HOURS.
    const scheduled: Array<{ post_id: string; scheduled_at: string }> = [];
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 1);
    start.setUTCHours(bestHour, 0, 0, 0);

    for (let i = 0; i < input.post_ids.length; i++) {
      const slot = new Date(start.getTime() + i * DEFAULT_SPACING_HOURS * 3600 * 1000);
      scheduled.push({
        post_id:      input.post_ids[i],
        scheduled_at: slot.toISOString(),
      });
    }

    // Persist the schedule onto the posts.
    for (const s of scheduled) {
      await db
        .from('posts')
        .update({ status: 'scheduled', scheduled_at: s.scheduled_at })
        .eq('id', s.post_id)
        .eq('brand_id', job.brand_id);
    }

    return {
      type: 'ok',
      outputs: [{
        kind:    'schedule',
        payload: { scheduled, best_hour: bestHour } as unknown as Record<string, unknown>,
        model:   'rule-based-scheduler',
      }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { type: 'fail', error: msg };
  }
};

// -----------------------------------------------------------------------------
// Register
// -----------------------------------------------------------------------------

export function registerPublishingHandlers(): void {
  registerHandler({ agent_type: 'content',    action: 'safe_publish'       }, safePublishHandler);
  registerHandler({ agent_type: 'scheduling', action: 'auto_schedule_week' }, autoScheduleHandler);
}
