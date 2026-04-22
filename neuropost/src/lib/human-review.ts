import type { HumanReviewConfig, HumanReviewDefaults } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export const HRC_KEY = 'human_review_defaults';

export const HARD_DEFAULT: HumanReviewDefaults = {
  messages: true,
  images:   true,
  videos:   true,
  requests: true,
};

export const HRC_UI_KEYS = ['messages', 'images', 'videos'] as const;
export type HrcUiKey = typeof HRC_UI_KEYS[number];

/** Read the global defaults from app_settings. Falls back to HARD_DEFAULT
 *  if the row is missing (fresh install / seed not applied yet). */
export async function getHumanReviewDefaults(db: DB): Promise<HumanReviewDefaults> {
  const { data } = await db
    .from('app_settings')
    .select('value')
    .eq('key', HRC_KEY)
    .single();
  const v = (data?.value ?? {}) as Partial<HumanReviewDefaults>;
  return {
    messages: v.messages ?? HARD_DEFAULT.messages,
    images:   v.images   ?? HARD_DEFAULT.images,
    videos:   v.videos   ?? HARD_DEFAULT.videos,
    requests: v.requests ?? HARD_DEFAULT.requests,
  };
}

/** Resolve the effective config for a brand, merging global defaults
 *  with the brand's diff override. */
export function resolveHumanReviewConfig(
  brandOverride: Partial<HumanReviewConfig> | null | undefined,
  defaults:      HumanReviewDefaults,
): HumanReviewConfig {
  return { ...defaults, ...(brandOverride ?? {}) };
}

/** Compute the diff override: only keys where the desired value differs
 *  from the defaults. Returns null if there is no difference (brand
 *  should inherit everything → human_review_config = null). */
export function computeDiffOverride(
  desired:  HumanReviewConfig,
  defaults: HumanReviewDefaults,
): Partial<HumanReviewConfig> | null {
  const diff: Partial<HumanReviewConfig> = {};
  (Object.keys(defaults) as Array<keyof HumanReviewConfig>).forEach((k) => {
    if (desired[k] !== defaults[k]) diff[k] = desired[k];
  });
  return Object.keys(diff).length === 0 ? null : diff;
}
