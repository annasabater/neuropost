// ─────────────────────────────────────────────────────────────────────────────
// Postly — EditorAgent prompts
// ─────────────────────────────────────────────────────────────────────────────

import type { EditingLevel } from './types';
import type { AgentContext } from '../shared/types';

/**
 * Builds the system prompt that frames Claude as a brand-aware photo analyst
 * for the specific business.
 */
export function buildEditorSystemPrompt(context: AgentContext): string {
  return `You are an expert social media photo analyst and editor for ${context.businessName}, a ${context.brandVoice.sector} business.

Your job is to analyse photos submitted for Instagram and Facebook posting and return professional editing assessments optimised for engagement in the ${context.brandVoice.sector} sector.

Brand context:
- Tone: ${context.brandVoice.tone}
- Language: ${context.brandVoice.language}
- Core keywords: ${context.brandVoice.keywords.join(', ')}

Rules:
1. Return ONLY valid JSON. No markdown, no explanation outside the JSON.
2. Be specific and actionable in qualityIssues and editingNarrative.
3. visualTags must reflect what is literally in the photo, not the brand — they feed the next agent.
4. Editing parameters must be conservative: prefer natural-looking results over heavy filters.`;
}

// ─── Per-level user prompts ───────────────────────────────────────────────────

const ANALYSIS_SCHEMA = `{
  "isSuitable": boolean,
  "suitabilityReason": string | null,
  "dominantColors": string[],           // top-3 hex codes, e.g. ["#FF6B6B","#FFF5F5"]
  "composition": "portrait" | "landscape" | "square" | "unknown",
  "mainSubjects": string[],
  "qualityScore": number,               // 0–10 integer
  "qualityIssues": string[],
  "lightingCondition": "natural" | "artificial" | "mixed" | "dark" | "overexposed",
  "suggestedCrop": { "aspectRatio": "1:1" | "4:5" | "16:9", "focusPoint": { "x": number, "y": number } } | null
}`;

const PARAMS_SCHEMA = `{
  "brightness": number,   // −100 to 100
  "contrast": number,     // −100 to 100
  "saturation": number,   // −100 to 100
  "sharpness": number,    // 0 to 100
  "warmth": number,       // −100 to 100
  "vignette": number,     // 0 to 100
  "filter": string | null
}`;

const LEVEL_PROMPTS: Record<EditingLevel, (ctx?: string) => string> = {
  0: (ctx) => `${ctx ? `Context from uploader: "${ctx}"\n\n` : ''}Analyse this photo and assess its suitability for social media posting.

Return this exact JSON structure:
{
  "analysis": ${ANALYSIS_SCHEMA},
  "editingParameters": null,
  "editingNarrative": null,
  "visualTags": string[]
}`,

  1: (ctx) => `${ctx ? `Context from uploader: "${ctx}"\n\n` : ''}Analyse this photo and provide light enhancement parameters to improve it for social media.

Return this exact JSON structure:
{
  "analysis": ${ANALYSIS_SCHEMA},
  "editingParameters": ${PARAMS_SCHEMA},
  "editingNarrative": null,
  "visualTags": string[]
}`,

  2: (ctx) => `${ctx ? `Context from uploader: "${ctx}"\n\n` : ''}Analyse this photo and provide a full professional editing assessment, including specific parameters and a narrative explanation of your editing strategy.

Return this exact JSON structure:
{
  "analysis": ${ANALYSIS_SCHEMA},
  "editingParameters": ${PARAMS_SCHEMA},
  "editingNarrative": string,   // 2–3 sentences: what you'd do and why it suits the brand
  "visualTags": string[]
}`,
};

/**
 * Builds the user turn prompt for a given editing level.
 *
 * @param level        Editing depth (0 = analyse only, 1 = light, 2 = full)
 * @param photoContext Optional uploader note about the photo's content
 */
export function buildEditorUserPrompt(level: EditingLevel, photoContext?: string): string {
  return LEVEL_PROMPTS[level](photoContext);
}
