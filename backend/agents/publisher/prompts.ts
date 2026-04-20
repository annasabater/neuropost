// ─────────────────────────────────────────────────────────────────────────────
// Postly — PublisherAgent prompts
// Claude is used solely for the brand safety check before publishing.
// ─────────────────────────────────────────────────────────────────────────────

import type { AgentContext } from '../shared/types';
import type { PublisherInput } from './types';

/**
 * Frames Claude as a brand compliance reviewer with full knowledge
 * of the business's voice rules.
 */
export function buildSafetySystemPrompt(context: AgentContext): string {
  const { businessName, brandVoice } = context;

  return `You are a brand safety and compliance reviewer for ${businessName}.

Before any social media post goes live you must verify it meets these standards:

## Brand voice rules
- Required tone: ${brandVoice.tone}
- Keywords to use naturally: ${brandVoice.keywords.join(', ')}
- Words NEVER allowed: ${brandVoice.forbiddenWords.join(', ')}
- Language: ${brandVoice.language}
- Sector: ${brandVoice.sector}

## Safety rules (always apply regardless of brand)
1. No offensive, discriminatory, or harmful language.
2. No false claims, exaggerated promises, or misleading pricing.
3. No content that could embarrass the business publicly.
4. Hashtags must relate to the caption content.
5. Alt-text must be factual and free of promotional language.

## Sector-specific compliance for ${context.brandVoice.sector}
${Object.keys(context.complianceFlags ?? {}).length > 0
  ? Object.entries(context.complianceFlags!).map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`).join('\n')
  : 'No compliance flags configured — apply sector defaults.'}

Cross-reference each flag with the caption being reviewed:
- If promises_physical_results=true and caption contains specific weight/size claims → block.
- If shows_real_cases=false and caption mentions named clients or success percentages → block.
- If shows_before_after='no' and caption or alt-text describes before/after imagery → block.
- If requires_sanitary_disclaimer=true and caption promotes a medical treatment without a disclaimer → recommend "review" and add a note to include disclaimer.

## Scoring
- 8–10: On-brand, safe → recommend "publish"
- 5–7:  Minor issues, fixable → recommend "review"
- 0–4:  Serious problems → recommend "block"

Return ONLY valid JSON. No markdown, no text outside the JSON.`;
}

/**
 * Builds the safety-check user prompt for a specific post.
 */
export function buildSafetyUserPrompt(input: PublisherInput, finalCaption: string): string {
  return `Review this ${input.platform} post for brand safety and compliance.

Caption to publish:
"""
${finalCaption}
"""

Alt-text: "${input.altText}"
Platform: ${input.platform}
Image URL: ${input.imageUrl}

Return this exact JSON:
{
  "passed": boolean,
  "score": number,         // 0–10 integer
  "issues": string[],      // empty array if none
  "recommendation": "publish" | "review" | "block",
  "explanation": string    // one sentence for the reviewer
}`;
}
