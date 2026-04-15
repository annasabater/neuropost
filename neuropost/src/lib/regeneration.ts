// =============================================================================
// NEUROPOST — Regeneration limits & weekly quota
// =============================================================================
// Business rules:
//   • Each post has 3 FREE regenerations (regeneration_count 0→3).
//   • From the 4th regeneration onward, 1 post is deducted from the weekly quota.
//   • Weeks run Mon–Sun UTC. Reset happens every Monday at 00:00 UTC.
//   • One carousel = 1 post regardless of photo count.
//   • Plan limits are read from PLAN_LIMITS (single source of truth).
// =============================================================================

import { createAdminClient } from '@/lib/supabase';
import { PLAN_LIMITS } from '@/types';
import type { SubscriptionPlan } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CanRegenerateResult {
  allowed:           boolean;
  reason?:           string;
  /** true when this regen will cost 1 post from the weekly quota */
  willCostQuota:     boolean;
  /** How many posts of this type remain after the potential cost */
  quotaAfter?:       number;
  regenerationCount: number;
  upgradeUrl?:       string;
}

export interface RemainingQuota {
  photoPostsRemaining: number;
  videoPostsRemaining: number;
  photoPostsLimit:     number;
  videoPostsLimit:     number;
  weekStart:           Date;
  plan:                SubscriptionPlan;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/** Returns the Monday 00:00 UTC of the week containing `date`. */
export function getWeekStart(date: Date = new Date()): Date {
  const d    = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day  = d.getUTCDay(); // 0=Sun, 1=Mon, …
  const diff = day === 0 ? -6 : 1 - day;  // adjust so Monday = 0
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

/** ISO date string for a week-start Date: "2025-04-14" */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── Core DB helpers ──────────────────────────────────────────────────────────

interface WeeklyUsageRow {
  id?:               string;
  brand_id:          string;
  week_start:        string;
  photo_posts_used:  number;
  video_posts_used:  number;
  plan:              string;
}

async function getOrCreateWeeklyUsage(
  brandId:   string,
  weekStart: Date,
  plan:      SubscriptionPlan,
): Promise<WeeklyUsageRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const ws = toDateStr(weekStart);

  const { data: existing } = await supabase
    .from('weekly_usage')
    .select('*')
    .eq('brand_id', brandId)
    .eq('week_start', ws)
    .single();

  if (existing) return existing as WeeklyUsageRow;

  const { data: created, error } = await supabase
    .from('weekly_usage')
    .insert({ brand_id: brandId, week_start: ws, plan, photo_posts_used: 0, video_posts_used: 0 })
    .select()
    .single();

  if (error) throw new Error(`weekly_usage insert failed: ${error.message}`);
  return created as WeeklyUsageRow;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * canRegenerate — check if a post can be regenerated.
 *
 * @param postId   — UUID of the post to regenerate
 * @param brandId  — brand that owns the post (used for quota lookup)
 */
export async function canRegenerate(
  postId:  string,
  brandId: string,
): Promise<CanRegenerateResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  // Fetch post + brand plan in parallel
  const [postRes, brandRes] = await Promise.all([
    supabase.from('posts').select('id, regeneration_count, format, brand_id').eq('id', postId).single(),
    supabase.from('brands').select('plan').eq('id', brandId).single(),
  ]);

  if (!postRes.data) return { allowed: false, willCostQuota: false, regenerationCount: 0, reason: 'Post no encontrado' };

  const post             = postRes.data as { id: string; regeneration_count: number; format: string; brand_id: string };
  const plan             = ((brandRes.data?.plan ?? 'starter') as SubscriptionPlan);
  const limits           = PLAN_LIMITS[plan];
  const regenCount       = post.regeneration_count ?? 0;
  const isVideo          = post.format === 'reel';

  // Under 3 → free regeneration
  if (regenCount < 3) {
    return { allowed: true, willCostQuota: false, regenerationCount: regenCount };
  }

  // 3rd or more → costs 1 post from weekly quota
  const weekStart = getWeekStart();
  const usage     = await getOrCreateWeeklyUsage(brandId, weekStart, plan);

  if (isVideo) {
    const limit = limits.videosPerWeek;
    if (limit === 0) {
      return {
        allowed:           false,
        willCostQuota:     true,
        regenerationCount: regenCount,
        reason:            `La generación de vídeo no está incluida en el plan ${plan}.`,
        upgradeUrl:        `${APP_URL()}/settings/plan`,
      };
    }
    const remaining = limit - (usage.video_posts_used ?? 0);
    if (remaining <= 0) {
      return {
        allowed:           false,
        willCostQuota:     true,
        regenerationCount: regenCount,
        reason:            `Has alcanzado el límite semanal de tu plan ${plan}. Se restablece cada lunes.`,
        upgradeUrl:        `${APP_URL()}/settings/plan`,
      };
    }
    return { allowed: true, willCostQuota: true, quotaAfter: remaining - 1, regenerationCount: regenCount };
  } else {
    const limit     = limits.postsPerWeek;
    const remaining = limit - (usage.photo_posts_used ?? 0);
    if (remaining <= 0) {
      return {
        allowed:           false,
        willCostQuota:     true,
        regenerationCount: regenCount,
        reason:            `Has alcanzado el límite semanal de tu plan ${plan}. Se restablece cada lunes.`,
        upgradeUrl:        `${APP_URL()}/settings/plan`,
      };
    }
    return { allowed: true, willCostQuota: true, quotaAfter: remaining - 1, regenerationCount: regenCount };
  }
}

/**
 * registerRegeneration — call AFTER a successful regeneration.
 *
 * Increments post.regeneration_count.
 * If count was already >= 3, also deducts 1 from weekly_usage.
 */
export async function registerRegeneration(
  postId:  string,
  brandId: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  // Fetch post
  const { data: post } = await supabase
    .from('posts')
    .select('regeneration_count, format')
    .eq('id', postId)
    .single();

  const prevCount = (post?.regeneration_count ?? 0) as number;
  const newCount  = prevCount + 1;
  const isVideo   = post?.format === 'reel';

  // Increment counter on the post
  await supabase
    .from('posts')
    .update({ regeneration_count: newCount })
    .eq('id', postId);

  // If the PREVIOUS count was already >= 3, this regen costs quota
  if (prevCount >= 3) {
    const { data: brand } = await supabase
      .from('brands')
      .select('plan')
      .eq('id', brandId)
      .single();

    const plan      = ((brand?.plan ?? 'starter') as SubscriptionPlan);
    const weekStart = getWeekStart();
    const usage     = await getOrCreateWeeklyUsage(brandId, weekStart, plan);

    if (isVideo) {
      await supabase
        .from('weekly_usage')
        .update({ video_posts_used: (usage.video_posts_used ?? 0) + 1 })
        .eq('brand_id', brandId)
        .eq('week_start', toDateStr(weekStart));
    } else {
      await supabase
        .from('weekly_usage')
        .update({ photo_posts_used: (usage.photo_posts_used ?? 0) + 1 })
        .eq('brand_id', brandId)
        .eq('week_start', toDateStr(weekStart));
    }
  }
}

/**
 * getRemainingQuota — how many posts/videos the brand has left this week.
 */
export async function getRemainingQuota(brandId: string): Promise<RemainingQuota> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  const { data: brand } = await supabase
    .from('brands')
    .select('plan')
    .eq('id', brandId)
    .single();

  const plan      = ((brand?.plan ?? 'starter') as SubscriptionPlan);
  const limits    = PLAN_LIMITS[plan];
  const weekStart = getWeekStart();
  const usage     = await getOrCreateWeeklyUsage(brandId, weekStart, plan);

  return {
    photoPostsRemaining: Math.max(0, limits.postsPerWeek   - (usage.photo_posts_used ?? 0)),
    videoPostsRemaining: Math.max(0, limits.videosPerWeek  - (usage.video_posts_used ?? 0)),
    photoPostsLimit:     limits.postsPerWeek,
    videoPostsLimit:     limits.videosPerWeek,
    weekStart,
    plan,
  };
}
