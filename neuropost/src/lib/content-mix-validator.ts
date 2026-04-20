import { PLAN_CONTENT_QUOTAS, type PlanKey } from './plan-limits';

export interface ContentMixPreferences {
  posts?: {
    carousel?: number;
    reel?:     number;
  };
  stories_templates_enabled?: string[];
}

export interface MixValidationResult {
  valid:  boolean;
  errors: string[];
}

/**
 * Validates proposed content_mix_preferences against a plan's quotas.
 *
 * Rules:
 * - carousel + reel must equal posts_per_week for the plan
 * - formats used must be in allowed_post_formats for the plan
 * - if posts_mix_configurable is false, only carousel is allowed (reel must be 0)
 */
export function validateContentMix(
  plan:        PlanKey,
  preferences: ContentMixPreferences,
): MixValidationResult {
  const quota  = PLAN_CONTENT_QUOTAS[plan];
  const errors: string[] = [];

  const carousel = preferences.posts?.carousel ?? 0;
  const reel     = preferences.posts?.reel     ?? 0;
  const total    = carousel + reel;

  if (total !== quota.posts_per_week) {
    errors.push(
      `La suma de carrusel (${carousel}) + reel (${reel}) debe ser exactamente ${quota.posts_per_week} (tu cuota semanal).`,
    );
  }

  if (carousel < 0 || reel < 0) {
    errors.push('Los valores de carousel y reel no pueden ser negativos.');
  }

  if (!quota.posts_mix_configurable && reel > 0) {
    errors.push(
      `Tu plan solo permite carruseles. No puedes asignar reels.`,
    );
  }

  const allowed = quota.allowed_post_formats as readonly string[];
  if (reel > 0 && !allowed.includes('reel')) {
    errors.push(`El formato "reel" no está disponible en tu plan.`);
  }
  if (carousel > 0 && !allowed.includes('carousel')) {
    errors.push(`El formato "carousel" no está disponible en tu plan.`);
  }

  return { valid: errors.length === 0, errors };
}
