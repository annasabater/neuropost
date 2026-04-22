import type { HumanReviewConfig, HumanReviewDefaults } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export const HRC_KEY = 'human_review_defaults';

export const HARD_DEFAULT: HumanReviewDefaults = {
  messages_create: true,
  images_create:   true,
  videos_create:   true,
  messages_regen:  true,
  images_regen:    true,
  videos_regen:    true,
  requests:        true,
};

export const HRC_UI_KEYS_CREATE = ['messages_create', 'images_create', 'videos_create'] as const;
export const HRC_UI_KEYS_REGEN  = ['messages_regen',  'images_regen',  'videos_regen']  as const;
export const HRC_UI_KEYS        = [...HRC_UI_KEYS_CREATE, ...HRC_UI_KEYS_REGEN] as const;

export type HrcUiKey       = typeof HRC_UI_KEYS[number];
export type HrcUiKeyCreate = typeof HRC_UI_KEYS_CREATE[number];
export type HrcUiKeyRegen  = typeof HRC_UI_KEYS_REGEN[number];

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
    messages_create: v.messages_create ?? HARD_DEFAULT.messages_create,
    images_create:   v.images_create   ?? HARD_DEFAULT.images_create,
    videos_create:   v.videos_create   ?? HARD_DEFAULT.videos_create,
    messages_regen:  v.messages_regen  ?? HARD_DEFAULT.messages_regen,
    images_regen:    v.images_regen    ?? HARD_DEFAULT.images_regen,
    videos_regen:    v.videos_regen    ?? HARD_DEFAULT.videos_regen,
    requests:        v.requests        ?? HARD_DEFAULT.requests,
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
