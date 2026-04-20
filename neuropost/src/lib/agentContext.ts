// =============================================================================
// NEUROPOST — Build AgentContext from a Brand row
// =============================================================================
//
// This is the canonical bridge between a persisted brand kit and the agents.
// Whenever we add a new preference to the brand kit (colors, forbidden
// topics, carousel size, etc.), we MUST expose it here so every agent that
// calls brandToAgentContext() picks it up automatically.

import { normalizePreferences } from '@/lib/plan-features';
import type { AgentContext, Brand, BrandVoice, SocialAccounts } from '@/types';

export function brandToAgentContext(brand: Brand): AgentContext {
  const brandVoice: BrandVoice = {
    tone:            brand.tone            ?? 'cercano',
    keywords:        brand.hashtags        ?? [],
    forbiddenWords:  brand.rules?.forbiddenWords  ?? [],
    forbiddenTopics: brand.rules?.forbiddenTopics ?? [],
    noEmojis:        brand.rules?.noEmojis        ?? false,
    sector:          brand.sector                 ?? 'otro',
    language:        (brand.rules as Record<string, unknown> | null)?.['language'] as string | undefined ?? 'es',
    exampleCaptions: brand.slogans               ?? [],
  };

  const socialAccounts: SocialAccounts = {
    instagramId:    brand.ig_account_id  ?? undefined,
    facebookPageId: brand.fb_page_id     ?? undefined,
    accessToken:    brand.ig_access_token ?? brand.fb_access_token ?? '',
  };

  return {
    businessId:        brand.id,
    businessName:      brand.name,
    brandVoice,
    socialAccounts,
    timezone:          brand.timezone ?? 'Europe/Madrid',
    subscriptionTier:  brand.plan,
    brandVoiceDoc:     brand.brand_voice_doc      ?? undefined,
    visualStyle:       brand.visual_style         ?? undefined,
    colors:            brand.colors,
    secondarySectors:  brand.secondary_sectors    ?? undefined,
    preferences:       normalizePreferences(brand.plan, brand.rules?.preferences),
  };
}
