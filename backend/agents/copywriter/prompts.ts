// ─────────────────────────────────────────────────────────────────────────────
// Postly — CopywriterAgent prompts
// ─────────────────────────────────────────────────────────────────────────────

import type { AgentContext } from '../shared/types';
import type { CopywriterInput } from './types';

// ─── System prompt ────────────────────────────────────────────────────────────

/**
 * Frames Claude as a brand-fluent social media copywriter for the business.
 * Injects the full brand voice document so every output stays on-brand.
 */
export function buildCopywriterSystemPrompt(context: AgentContext): string {
  const { businessName, brandVoice } = context;
  const examples = brandVoice.exampleCaptions
    .map((c, i) => `  ${i + 1}. "${c}"`)
    .join('\n');

  return `You are an expert social media copywriter for ${businessName}, a ${brandVoice.sector} business.

## Brand voice document
- Tone: ${brandVoice.tone}
- Language: ${brandVoice.language} — write ALL copy in this language
- Keywords to use naturally: ${brandVoice.keywords.join(', ')}
- Words NEVER to use: ${brandVoice.forbiddenWords.join(', ')}
- Real caption examples from this brand:
${examples}

## Product catalog (use when generating posts about products)
${context.products && context.products.length > 0
  ? context.products.map(p => `- ${p.name}${p.price_cents ? ` (${(p.price_cents / 100).toFixed(2)}${p.currency ?? 'EUR'})` : ''}${p.main_benefit ? ` — ${p.main_benefit}` : ''}${p.is_hero ? ' ★ hero' : ''}`).join('\n')
  : 'No catalog provided — write about the business generically.'}

## Target audience
${context.personas && context.personas.length > 0
  ? context.personas.map(p => `- ${p.persona_name}${p.lifestyle ? ` · ${p.lifestyle}` : ''}\n  wants: ${p.desires.join(', ')}\n  struggles with: ${p.pains.join(', ')}\n  uses words: ${p.lingo_yes.join(', ')}\n  avoid words: ${p.lingo_no.join(', ')}`).join('\n\n')
  : 'No personas provided — write for a broad audience.'}

## Craft rules
1. Match the tone precisely — read the examples carefully. Use the audience's vocabulary ('uses words') and avoid forbidden words for both the brand (forbiddenWords) and the personas (avoid words).
2. Instagram captions: conversational, 150–300 chars (story first, hashtags after two line breaks).
3. Facebook posts: punchy, 40–80 chars, no hashtags in copy body.
4. Hashtags: use the language code "${brandVoice.language}" as a guide for local vs. global mix.
5. Alt-text: factual, ≤ 125 chars, no brand voice.
6. Return ONLY valid JSON. No markdown. No text outside the JSON object.`;
}

// ─── User prompt ──────────────────────────────────────────────────────────────

const GOAL_INSTRUCTIONS: Record<CopywriterInput['goal'], string> = {
  engagement: 'Maximise comments and saves. Ask a question or spark curiosity.',
  awareness:  'Introduce the business to new audiences. Highlight what makes it unique.',
  promotion:  'Drive purchase intent. Lead with the offer, include price if provided.',
  community:  'Celebrate customers or the local area. Warm, inclusive, personal.',
};

const OUTPUT_SCHEMA = `{
  "copies": {
    "instagram"?: {
      "caption": string,
      "charCount": number
    },
    "facebook"?: {
      "caption": string,
      "charCount": number
    }
  },
  "hashtags": {
    "branded": string[],   // 2–3 business-specific tags
    "niche":   string[],   // 5–7 sector/product tags
    "broad":   string[]    // 3–5 high-volume discovery tags
  },
  "callToAction": string,
  "altText": string,
  "strategySummary": string
}`;

/**
 * Builds the user turn that carries the visual context and task parameters.
 */
export function buildCopywriterUserPrompt(input: CopywriterInput): string {
  const platformList = input.platforms.join(' and ');
  const subjectsLine = input.imageAnalysis.mainSubjects.length
    ? `Main subjects in photo: ${input.imageAnalysis.mainSubjects.join(', ')}.`
    : '';
  const tagsLine = `Visual tags: ${input.visualTags.join(', ')}.`;
  const contextLine = input.postContext ? `Extra context: "${input.postContext}".` : '';
  const productBlock = input.product
    ? `Product featured: ${input.product.name}${input.product.price ? ` — ${input.product.price}` : ''}${input.product.description ? `. ${input.product.description}` : ''}.`
    : '';
  const goalLine = `Post goal: ${GOAL_INSTRUCTIONS[input.goal]}`;
  const platformsLine = `Generate copy for: ${platformList}. Only include those keys in "copies".`;

  const lines = [subjectsLine, tagsLine, contextLine, productBlock, goalLine, platformsLine]
    .filter(Boolean)
    .join('\n');

  return `${lines}

Return this exact JSON structure:
${OUTPUT_SCHEMA}`;
}
