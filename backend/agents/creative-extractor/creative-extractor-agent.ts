// ─────────────────────────────────────────────────────────────────────────────
//  CreativeExtractorAgent
//  ────────────────────────
//  Turns viral / high-performing social content into a reusable
//  "creative recipe" JSON (see types.ts / prompts.ts).
//
//  Accepts either a visual (imageUrl → Claude vision) or a textual
//  description. Output is the structured recipe plus the embeddingText
//  the handler feeds into OpenAI embeddings.
// ─────────────────────────────────────────────────────────────────────────────

import type Anthropic from '@anthropic-ai/sdk';
import { BaseAgent } from '../shared/base-agent';
import { getClaudeClient, CLAUDE_MODEL, withRetry } from '../shared/claude-client';
import type { AgentContext } from '../shared/types';
import type {
  CreativeRecipe,
  ExtractorInput,
  ExtractorOutput,
} from './types';
import { EXTRACTOR_SYSTEM_PROMPT, buildExtractorUserPrompt } from './prompts';

const REQUIRED_TOP_LEVEL = [
  'type', 'platform', 'creative_prompt', 'hook', 'description',
  'visual_style', 'content_structure', 'subject', 'audio_style',
  'text_overlay', 'caption_analysis', 'objective', 'target_emotion',
  'target_audience', 'industry_vertical', 'reusability', 'tags',
  'quality_score', 'virality_signals',
] as const;

export class CreativeExtractorAgent extends BaseAgent<ExtractorInput, ExtractorOutput> {
  constructor() {
    super('CreativeExtractorAgent');
  }

  protected async execute(
    input:       ExtractorInput,
    context:     AgentContext,
    executionId: string,
  ): Promise<ExtractorOutput> {
    this.validateInput(input);

    this.log('info', 'Creative recipe extraction started', {
      executionId,
      platform:      input.platform,
      hasImage:      !!input.imageUrl,
      hasCaption:    !!input.caption,
      hasDescription:!!input.description,
    });

    const response = await withRetry(() =>
      getClaudeClient().messages.create({
        model:      CLAUDE_MODEL,
        max_tokens: 3000,
        system:     EXTRACTOR_SYSTEM_PROMPT,
        messages: [
          {
            role:    'user',
            content: this.buildUserContent(input),
          },
        ],
      }),
    );

    const recipe = this.parseRecipe(response, executionId);
    const embeddingText = this.buildEmbeddingText(recipe);

    this.log('info', 'Creative recipe extraction complete', {
      executionId,
      quality:  recipe.quality_score,
      type:     recipe.type,
      niche:    recipe.industry_vertical,
      tagCount: recipe.tags.length,
    });

    void context; // Agent context not needed for extraction — recipes are brand-agnostic.
    return { recipe, embeddingText };
  }

  // ─── Private ────────────────────────────────────────────────────────────

  /**
   * Build the user message content. If we have an image URL, send a
   * multi-part message with the image + text; otherwise plain text.
   */
  private buildUserContent(input: ExtractorInput): Anthropic.Messages.MessageParam['content'] {
    const textBlock = buildExtractorUserPrompt(input);

    if (input.imageUrl) {
      return [
        {
          type:   'image',
          source: {
            type:      'url',
            url:       input.imageUrl,
          },
        },
        { type: 'text', text: textBlock },
      ] as Anthropic.Messages.MessageParam['content'];
    }
    return textBlock;
  }

  private parseRecipe(response: Anthropic.Message, executionId: string): CreativeRecipe {
    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('CreativeExtractor: Claude returned no text block');
    }

    const cleaned = textBlock.text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      this.log('error', 'Recipe JSON parse failed', {
        executionId,
        raw: textBlock.text.slice(0, 400),
      });
      throw new Error('CreativeExtractor: Claude response is not valid JSON');
    }

    // Agent explicitly refused the content (minor, etc.)
    if (
      parsed && typeof parsed === 'object' && 'error' in parsed
      && (parsed as { error: unknown }).error === 'content_not_analyzable'
    ) {
      throw new Error('Content not analysable (safety policy refused).');
    }

    this.assertValidRecipe(parsed);
    return this.normaliseRecipe(parsed as Record<string, unknown>);
  }

  private assertValidRecipe(value: unknown): asserts value is Record<string, unknown> {
    if (!value || typeof value !== 'object') {
      throw new Error('CreativeExtractor: response is not a JSON object');
    }
    const obj = value as Record<string, unknown>;
    for (const key of REQUIRED_TOP_LEVEL) {
      if (!(key in obj)) {
        throw new Error(`CreativeExtractor: missing required field "${key}"`);
      }
    }
  }

  /**
   * Soft-coerces missing sub-fields + caps tags to the documented range
   * (4–10). Sanitisation here means downstream code can trust the shape
   * fully without per-field null checks.
   */
  private normaliseRecipe(raw: Record<string, unknown>): CreativeRecipe {
    const r = raw as unknown as CreativeRecipe;

    // Cap quality_score to 1-10
    if (typeof r.quality_score !== 'number' || isNaN(r.quality_score)) r.quality_score = 5;
    r.quality_score = Math.max(1, Math.min(10, Math.round(r.quality_score)));

    // Cap hook.strength_1_10
    if (r.hook && typeof r.hook.strength_1_10 === 'number') {
      r.hook.strength_1_10 = Math.max(1, Math.min(10, Math.round(r.hook.strength_1_10)));
    }

    // Ensure arrays exist
    r.tags                              = Array.isArray(r.tags)                              ? r.tags.filter((t): t is string => typeof t === 'string') : [];
    r.visual_style.color_palette        = Array.isArray(r.visual_style?.color_palette)       ? r.visual_style.color_palette                                   : [];
    r.content_structure.key_elements    = Array.isArray(r.content_structure?.key_elements)   ? r.content_structure.key_elements                               : [];
    r.subject.secondary_elements        = Array.isArray(r.subject?.secondary_elements)       ? r.subject.secondary_elements                                   : [];
    r.subject.props                     = Array.isArray(r.subject?.props)                    ? r.subject.props                                                : [];
    r.text_overlay.examples             = Array.isArray(r.text_overlay?.examples)            ? r.text_overlay.examples                                        : [];

    // Tag count clamp: 4..10. If fewer than 4, we don't invent — we just keep what we have.
    if (r.tags.length > 10) r.tags = r.tags.slice(0, 10);

    return r;
  }

  /**
   * Concatenates the recipe fields that best describe its semantic essence
   * into a single string for the embedding call. Keeps the signal strong
   * while staying under the model's token window.
   */
  private buildEmbeddingText(r: CreativeRecipe): string {
    const bits: string[] = [];
    bits.push(`Platform: ${r.platform}. Type: ${r.type}. Niche: ${r.industry_vertical}${r.sub_niche ? ` / ${r.sub_niche}` : ''}.`);
    bits.push(r.creative_prompt);
    if (r.description) bits.push(r.description);
    if (r.hook?.text_or_description) bits.push(`Hook: ${r.hook.text_or_description}`);
    if (r.target_audience) bits.push(`Audience: ${r.target_audience}`);
    if (r.tags.length) bits.push(`Tags: ${r.tags.join(', ')}`);
    if (r.content_structure?.narrative_flow) bits.push(`Narrative: ${r.content_structure.narrative_flow}`);
    return bits.join('\n');
  }

  private validateInput(input: ExtractorInput): void {
    if (!input.platform) throw new Error('CreativeExtractor: platform is required');
    if (!input.imageUrl && !input.description && !input.caption) {
      throw new Error('CreativeExtractor: at least one of imageUrl, description, or caption is required');
    }
  }
}
