// =============================================================================
// NEUROPOST — Build AgentContext from a Brand row
// =============================================================================

import type { AgentContext, Brand, BrandVoice, SocialAccounts } from '@/types';

export function brandToAgentContext(brand: Brand): AgentContext {
  const brandVoice: BrandVoice = {
    tone:            brand.tone            ?? 'cercano',
    keywords:        brand.hashtags        ?? [],
    forbiddenWords:  brand.rules?.forbiddenWords ?? [],
    sector:          brand.sector          ?? 'otro',
    language:        'es',
    exampleCaptions: [],
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
    timezone:          'Europe/Madrid',
    subscriptionTier:  brand.plan,
    brandVoiceDoc:     brand.brand_voice_doc      ?? undefined,
    visualStyle:       brand.visual_style         ?? undefined,
    secondarySectors:  brand.secondary_sectors    ?? undefined,
  };
}
