// =============================================================================
// NEUROPOST — VisualStrategistAgent
// Acts as an AI creative director: takes a client brief + brand context +
// optional source images and inspiration references, then returns a structured
// AgentBrief that tells the image-generation step exactly how to proceed.
//
// Feature flag: VISUAL_STRATEGIST_ENABLED=true (env var)
// When false (default), autoStartPipeline calls fallbackBrief() and behaves
// identically to pre-Sprint-1 behaviour.
//
// Policy (4 scenarios):
//   A. source_images + inspirations  → source as primary_image_url, inspiration
//                                       visual attrs injected into prompt
//   B. no source_images + inspirations → best inspiration as primary_image_url
//                                         (img2img), brief = transformation desc
//   C. source_images, no inspirations → source as primary_image_url, txt/desc prompt
//   D. nothing                        → null primary, txt2img from scratch
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';
import { z }     from 'zod';
import type { BrandColors, VisualStyle, SocialSector } from '@/types';

// ── AgentBrief schema ─────────────────────────────────────────────────────────

export const AgentBriefSchema = z.object({
  intent:            z.string(),
  mode:              z.enum(['txt2img', 'img2img']),
  generation_prompt: z.string(),               // Replicate-ready, English
  guidance:          z.number().min(1).max(10),
  strength:          z.number().min(0).max(1).nullable(),
  model:             z.enum(['flux-pro', 'flux-kontext-pro']),
  confidence:        z.number().min(0).max(1),
  reasoning:         z.string(),
  risk_flags:        z.array(z.string()),
  primary_image_url: z.string().nullable(),
  inspiration_as_image: z.object({
    used:            z.boolean(),
    inspiration_id:  z.string().nullable(),
    url:             z.string().nullable(),
  }),
});

export type AgentBrief = z.infer<typeof AgentBriefSchema>;

// ── Input ─────────────────────────────────────────────────────────────────────

export interface Inspiration {
  id:            string;
  thumbnail_url: string;
}

export interface VisualStrategistInput {
  clientDescription:   string;
  brandContext:        string;
  sector:              SocialSector;
  visualStyle:         VisualStyle;
  colors?:             BrandColors | null;
  forbiddenWords?:     string[];
  format:              'post' | 'story' | 'reel_cover';
  /** Legacy single-image field — use sourceImages when possible. */
  sourceImageUrl?:     string | null;
  /** All client-uploaded source images (takes precedence over sourceImageUrl). */
  sourceImages?:       string[];
  /** Pre-built text description from inspiration tables (for text injection). */
  inspirationPrompt?:  string | null;
  /** Structured inspirations including their image URLs for vision analysis. */
  inspirations?:       Inspiration[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const anthropic = new Anthropic();

/** Normalise source images: merge sourceImages + sourceImageUrl into one array. */
function resolveSourceImages(input: VisualStrategistInput): string[] {
  if (input.sourceImages?.length) return input.sourceImages;
  if (input.sourceImageUrl)       return [input.sourceImageUrl];
  return [];
}

/** Produce a safe brief when the AI call fails so the pipeline never blocks. */
export function fallbackBrief(input: VisualStrategistInput): AgentBrief {
  const sources      = resolveSourceImages(input);
  const inspirations = input.inspirations ?? [];
  const hasSource    = sources.length > 0;
  const hasInsp      = inspirations.length > 0;

  // Determine case
  const useImg2img = hasSource || (hasInsp && !hasSource);
  const primaryUrl = hasSource
    ? sources[0]
    : hasInsp
      ? inspirations[0].thumbnail_url
      : null;

  const inspUsed = !hasSource && hasInsp;

  return {
    intent:            input.clientDescription || 'Contenido para redes sociales',
    mode:              useImg2img ? 'img2img' : 'txt2img',
    generation_prompt: [
      input.inspirationPrompt,
      input.clientDescription,
      `${input.visualStyle} style, professional photography`,
    ].filter(Boolean).join('. '),
    guidance:          useImg2img ? 2 : 3,
    strength:          useImg2img ? 0.65 : null,
    model:             useImg2img ? 'flux-kontext-pro' : 'flux-pro',
    confidence:        0.5,
    reasoning:         'Fallback brief (Visual Strategist unavailable).',
    risk_flags:        [],
    primary_image_url: primaryUrl,
    inspiration_as_image: {
      used:           inspUsed,
      inspiration_id: inspUsed ? (inspirations[0]?.id ?? null) : null,
      url:            inspUsed ? (inspirations[0]?.thumbnail_url ?? null) : null,
    },
  };
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM = `You are an AI Creative Director for a social-media content platform.
Your job is to analyse a client's brief, brand context, and optionally source images and inspiration references, then produce a precise image-generation brief for a Flux Pro model.

RULES:
1. Respond ONLY with a single valid JSON object — no markdown, no explanation.

2. **primary_image_url and inspiration_as_image** — deterministic rules based on inputs:

Case A — client uploaded source_images (non-empty):
- \`primary_image_url\` = first URL from source_images
- \`inspiration_as_image.used\` = false, url = null, inspiration_id = null
- If inspirations exist, do NOT pass them as images. Instead, analyze them visually and inject rich attribute description into \`generation_prompt\` (see "Inspiration handling" below).
- Model: flux-kontext-pro (img2img).

Case B — client has NO source_images but has inspirations:
- \`primary_image_url\` = the thumbnail_url of the chosen inspiration (the one that best matches the client's brief, or the first if brief is agnostic)
- \`inspiration_as_image.used\` = true
- \`inspiration_as_image.inspiration_id\` = that inspiration's id
- \`inspiration_as_image.url\` = same as primary_image_url
- The brief describes what to change or keep from the inspiration
- Model: flux-kontext-pro (img2img, using inspiration as base)

Case C — no source_images, no inspirations:
- \`primary_image_url\` = null
- \`inspiration_as_image.used\` = false, url = null, inspiration_id = null
- \`intent\` should include "new_creation"
- Model: flux-pro (txt2img)

You never pass BOTH source and inspiration as images simultaneously. Flux Kontext Pro accepts a single input_image only.

3. mode: "img2img" for Cases A and B, "txt2img" for Case C.
4. generation_prompt must be in English, Flux-optimised, ≤120 words.
5. guidance: 1-10 (higher = prompt-adherent; lower = creative freedom)
   - txt2img default range: 2.5-4
   - img2img default range: 1.5-2.5
6. strength: 0-1 for img2img (0=identical, 1=fully regenerated), null for txt2img
   - conservative edits: 0.4-0.55
   - style transfer: 0.65-0.80
7. model: "flux-pro" for txt2img, "flux-kontext-pro" for img2img
8. confidence: your certainty 0-1
9. risk_flags: list potential issues

## Inspiration handling

You receive inspiration images as image blocks in your user message when the client selected any. Your job differs by case:

**Case A (source + inspiration)**: Extract rich visual attributes from the inspiration and inject them INTO the \`generation_prompt\`. Extract:
1. Lighting: direction, hardness, temperature (e.g. "soft morning window light from the left, warm").
2. Color palette: dominant hues, accent colors, saturation level.
3. Composition: framing, angle, subject placement, negative space.
4. Texture & surface: materials visible, finishes.
5. Mood & atmosphere: editorial, cozy, minimal, vibrant, moody.
6. Post-processing style: film grain, clean digital, high contrast.
The prompt says WHAT the inspiration looks like in visual terms — never reference it by name. Never write "like the inspiration image" — write the concrete attributes. Keep 20-40 words of inspiration-derived attributes, embedded naturally alongside the client's subject description.

**Case B (inspiration only, no source)**: Select the inspiration that best matches the client's brief. Use the brief to describe what to change or adapt from the inspiration ("replace the pastry with a chocolate croissant, keep everything else").

**Case C (no inspirations)**: skip this section.

## Prompt writing rules

1. English only.
2. Replicate-optimised — natural language, not comma-lists of keywords.
3. Max 120 words.
4. No brand names, product names, or text overlays unless specifically requested.
5. No "AI-generated", "digital art", "CGI" unless requested.
6. No references to the inspiration image by name.
7. Include 2-3 quality/technical keywords at the end (e.g., "photorealistic, sharp focus, professional photography").
8. Case A: structure: "[subject description from source], [style attributes from inspiration], [brand mood], [quality keywords]". Source is authoritative on subject identity; inspiration shapes the rest.
9. Case B: describe the TRANSFORMATION ("replace X with Y", "keep composition but change Z"). The model sees the inspiration as input_image, so the prompt talks about modifications, not recreating from scratch.
10. Case C: full descriptive prompt from brief + brand context. Self-contained scene description — paint the scene completely.

JSON schema (all fields required):
{
  "intent": string,
  "mode": "txt2img"|"img2img",
  "generation_prompt": string,
  "guidance": number,
  "strength": number|null,
  "model": "flux-pro"|"flux-kontext-pro",
  "confidence": number,
  "reasoning": string,
  "risk_flags": string[],
  "primary_image_url": string|null,
  "inspiration_as_image": {
    "used": boolean,
    "inspiration_id": string|null,
    "url": string|null
  }
}`;

// ── Main function ─────────────────────────────────────────────────────────────

export async function runVisualStrategist(
  input: VisualStrategistInput,
): Promise<AgentBrief> {
  type ContentBlock =
    | { type: 'image'; source: { type: 'url'; url: string } }
    | { type: 'text';  text: string };

  const content: ContentBlock[] = [];

  const sources      = resolveSourceImages(input);
  const inspirations = input.inspirations ?? [];
  const hasSource    = sources.length > 0;
  const hasInsp      = inspirations.length > 0;

  // Determine case and attach image blocks
  if (hasSource) {
    // Case A: attach source image(s) for vision
    for (const url of sources.slice(0, 2)) {
      content.push({ type: 'image', source: { type: 'url', url } });
    }
    // Also attach inspiration images for visual analysis (Case A only)
    if (hasInsp) {
      for (const insp of inspirations.slice(0, 3)) {
        content.push({ type: 'image', source: { type: 'url', url: insp.thumbnail_url } });
      }
    }
  } else if (hasInsp) {
    // Case B: attach inspiration images so the model can choose the best one
    for (const insp of inspirations.slice(0, 3)) {
      content.push({ type: 'image', source: { type: 'url', url: insp.thumbnail_url } });
    }
  }
  // Case C: no images

  // Build XML brief
  const colorLine = input.colors?.primary
    ? `<brand_colors primary="${input.colors.primary}"${input.colors.secondary ? ` secondary="${input.colors.secondary}"` : ''} />`
    : '';

  const forbidden = input.forbiddenWords?.length
    ? `<forbidden_words>${input.forbiddenWords.join(', ')}</forbidden_words>`
    : '';

  const inspTextLine = input.inspirationPrompt
    ? `<inspiration_text>${input.inspirationPrompt}</inspiration_text>`
    : '';

  // Tell the model exactly what images were attached and their metadata
  const sourceImagesXml = hasSource
    ? `<source_images>${sources.map(u => `<url>${u}</url>`).join('')}</source_images>`
    : '<source_images />';

  const inspirationsXml = hasInsp
    ? `<inspirations>${inspirations.map(i => `<inspiration id="${i.id}" thumbnail_url="${i.thumbnail_url}" />`).join('')}</inspirations>`
    : '<inspirations />';

  const userXml = `<brief>
  <client_description>${input.clientDescription}</client_description>
  <brand_context>${input.brandContext}</brand_context>
  <sector>${input.sector}</sector>
  <visual_style>${input.visualStyle}</visual_style>
  <format>${input.format}</format>
  ${colorLine}
  ${forbidden}
  ${inspTextLine}
  ${sourceImagesXml}
  ${inspirationsXml}
</brief>

Images attached above (in order):${hasSource ? ` ${sources.slice(0,2).length} source image(s)` : ''}${hasSource && hasInsp ? ` then ${Math.min(inspirations.length,3)} inspiration image(s) for visual analysis` : ''}${!hasSource && hasInsp ? ` ${Math.min(inspirations.length,3)} inspiration image(s)` : ''}${!hasSource && !hasInsp ? ' none' : ''}

Produce the image generation brief as a JSON object following the schema above.`;

  content.push({ type: 'text', text: userXml });

  const response = await anthropic.messages.create({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 768,
    system:     SYSTEM,
    messages:   [{ role: 'user', content: content as Anthropic.MessageParam['content'] }],
  });

  const raw = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`VisualStrategistAgent: no JSON in response: ${raw.slice(0, 200)}`);
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const brief  = AgentBriefSchema.parse(parsed);
  return brief;
}
