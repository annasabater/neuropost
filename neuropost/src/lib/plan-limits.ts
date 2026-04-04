// =============================================================================
// NEUROPOST — Plan limits enforcement
// =============================================================================

import { createServerClient } from '@/lib/supabase';
import { PLAN_LIMITS } from '@/types';
import type { SubscriptionPlan } from '@/types';

export interface PlanLimitResult {
  allowed:     boolean;
  reason?:     string;
  upgradeUrl?: string;
}

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/** Check if a brand can create another post this week. */
export async function checkPostLimit(brandId: string): Promise<PlanLimitResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createServerClient() as any;
  const { data: brand } = await supabase
    .from('brands').select('plan, posts_this_week').eq('id', brandId).single();

  const plan  = (brand?.plan ?? 'starter') as SubscriptionPlan;
  const limit = PLAN_LIMITS[plan].postsPerWeek;
  const used  = brand?.posts_this_week ?? 0;

  if (used >= limit) {
    return {
      allowed:    false,
      reason:     `Has alcanzado el límite de ${limit} posts/semana del plan ${plan}. Se restablece cada lunes.`,
      upgradeUrl: `${appUrl()}/settings/plan`,
    };
  }
  return { allowed: true };
}

/** Check if a brand can publish a story this week. */
export async function checkStoryLimit(brandId: string): Promise<PlanLimitResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createServerClient() as any;
  const { data: brand } = await supabase
    .from('brands').select('plan, stories_this_week').eq('id', brandId).single();

  const plan  = (brand?.plan ?? 'starter') as SubscriptionPlan;
  const limit = PLAN_LIMITS[plan].storiesPerWeek;

  if (limit === 0) {
    return {
      allowed:    false,
      reason:     `Las historias no están incluidas en el plan ${plan}.`,
      upgradeUrl: `${appUrl()}/settings/plan`,
    };
  }

  const used = brand?.stories_this_week ?? 0;
  if (used >= limit) {
    return {
      allowed:    false,
      reason:     `Has alcanzado el límite de ${limit} historias/semana del plan ${plan}.`,
      upgradeUrl: `${appUrl()}/settings/plan`,
    };
  }
  return { allowed: true };
}

/** Check if a feature flag is enabled for a brand's plan. */
export async function checkFeature(
  brandId: string,
  feature: 'autoPublish' | 'competitorAgent' | 'trendsAgent' | 'autoComments',
): Promise<PlanLimitResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createServerClient() as any;
  const { data: brand } = await supabase.from('brands').select('plan').eq('id', brandId).single();

  const plan = (brand?.plan ?? 'starter') as SubscriptionPlan;
  if (!PLAN_LIMITS[plan][feature]) {
    const names: Record<string, string> = {
      autoPublish:     'publicación automática',
      competitorAgent: 'análisis de competencia',
      trendsAgent:     'agente de tendencias',
      autoComments:    'respuesta automática de comentarios',
    };
    return {
      allowed:    false,
      reason:     `La ${names[feature]} no está disponible en el plan ${plan}.`,
      upgradeUrl: `${appUrl()}/settings/plan`,
    };
  }
  return { allowed: true };
}

/** Check if a user can create another brand. */
export async function checkBrandLimit(userId: string): Promise<PlanLimitResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createServerClient() as any;
  const { data: brands } = await supabase.from('brands').select('id, plan').eq('user_id', userId);

  const count = brands?.length ?? 0;
  const plan  = (brands?.[0]?.plan ?? 'starter') as SubscriptionPlan;
  const limit = PLAN_LIMITS[plan].brands;

  if (count >= limit) {
    return {
      allowed:    false,
      reason:     `Tu plan ${plan} permite un máximo de ${limit} marca(s).`,
      upgradeUrl: `${appUrl()}/settings/plan`,
    };
  }
  return { allowed: true };
}

/** Increment post counter after successful publish. */
export async function incrementPostCounter(brandId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createServerClient() as any;
  const { data } = await supabase.from('brands').select('posts_this_week').eq('id', brandId).single();
  if (data) await supabase.from('brands').update({ posts_this_week: (data.posts_this_week ?? 0) + 1 }).eq('id', brandId);
}

// ─── Image quality by plan ────────────────────────────────────────────────────

import type { NanoBananaQuality } from './nanoBanana';

export const IMAGE_QUALITY_BY_PLAN: Record<SubscriptionPlan, NanoBananaQuality> = {
  starter: 'fast',   // quick and economical
  pro:     'pro',    // standard quality
  total:   'pro',    // standard quality + priority
  agency:  'ultra',  // maximum 4K quality
};

export const IMAGE_QUALITY_LABEL: Record<NanoBananaQuality, string> = {
  fast:  'Generació estàndard',
  pro:   'Generació Pro (qualitat alta)',
  ultra: 'Generació Ultra (màxima qualitat 4K)',
};

export const IMAGE_QUALITY_TIME: Record<NanoBananaQuality, string> = {
  fast:  '~5 seg',
  pro:   '~10 seg',
  ultra: '~15 seg',
};

/** Increment story counter after successful story publish. */
export async function incrementStoryCounter(brandId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createServerClient() as any;
  const { data } = await supabase.from('brands').select('stories_this_week').eq('id', brandId).single();
  if (data) await supabase.from('brands').update({ stories_this_week: (data.stories_this_week ?? 0) + 1 }).eq('id', brandId);
}
