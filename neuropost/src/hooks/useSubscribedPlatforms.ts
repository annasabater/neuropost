import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { PLAN_LIMITS } from '@/types';
import type { Platform, SubscriptionPlan, PostFormat } from '@/types';

/**
 * Returns the platforms the current brand is paying for, intersected with
 * what their plan tier allows. Use this everywhere you need to show or
 * filter by the client's active platforms.
 */
export function useSubscribedPlatforms() {
  const brand = useAppStore((s) => s.brand);

  return useMemo(() => {
    const plan: SubscriptionPlan = brand?.plan ?? 'starter';
    const limits = PLAN_LIMITS[plan];

    // What the brand has actually subscribed to (DB field, defaults to ['instagram'])
    const subscribed: Platform[] = brand?.subscribed_platforms?.length
      ? (brand.subscribed_platforms as Platform[])
      : ['instagram'];

    // Intersect with what the plan allows (e.g. starter can't have tiktok)
    const active = subscribed.filter((p) => limits.allowedPlatforms.includes(p));

    // Ensure at least instagram is always present
    if (active.length === 0) active.push('instagram');

    return {
      /** Platforms the client can actually use right now. */
      platforms: active as Platform[],
      /** Whether TikTok is available on this plan tier (even if not subscribed). */
      tiktokAvailable: limits.tiktokAvailable,
      /** Check if a specific platform is active. */
      has: (p: Platform) => active.includes(p),
      /** Filter a list of platforms to only subscribed ones. */
      filter: (list: Platform[]) => list.filter((p) => active.includes(p)),
      /** Platforms available for a given output format. */
      platformsForFormat: (format: PostFormat): Platform[] => {
        if (format === 'video' || format === 'reel') {
          // Video/reel can go to all three platforms
          return active;
        }
        // Photo/carousel only go to Instagram and Facebook
        return active.filter((p) => p !== 'tiktok');
      },
    };
  }, [brand?.plan, brand?.subscribed_platforms]);
}
