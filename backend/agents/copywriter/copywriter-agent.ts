// ─────────────────────────────────────────────────────────────────────────────
// Postly — CopywriterAgent
//
// Generates platform-specific captions, tiered hashtags, a call-to-action,
// and alt-text from the visual context produced by EditorAgent.
//
// Designed to be called immediately after EditorAgent in the pipeline:
//   EditorAgent.run() → CopywriterAgent.run()
// ─────────────────────────────────────────────────────────────────────────────

import type Anthropic from '@anthropic-ai/sdk';
import { BaseAgent } from '../shared/base-agent';
import { getClaudeClient, CLAUDE_MODEL, withRetry } from '../shared/claude-client';
import type { AgentContext } from '../shared/types';
import type { CopywriterInput, CopywriterOutput, Platform, PlatformCopy } from './types';
import { buildCopywriterSystemPrompt, buildCopywriterUserPrompt } from './prompts';

export class CopywriterAgent extends BaseAgent<CopywriterInput, CopywriterOutput> {
  constructor() {
    super('CopywriterAgent');
  }

  // ─── Core execution ────────────────────────────────────────────────────────

  protected async execute(
    input: CopywriterInput,
    context: AgentContext,
    executionId: string,
  ): Promise<CopywriterOutput> {
    this.log('info', 'Generating copy', {
      executionId,
      goal: input.goal,
      platforms: input.platforms,
      visualTagCount: input.visualTags.length,
    });

    const response = await withRetry(() =>
      getClaudeClient().messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        system: buildCopywriterSystemPrompt(context),
        messages: [
          {
            role: 'user',
            content: buildCopywriterUserPrompt(input),
          },
        ],
      }),
    );

    const output = this.extractAndValidate(response, input.platforms, executionId);

    this.log('info', 'Copy generation complete', {
      executionId,
      platforms: Object.keys(output.copies),
      hashtagTotal:
        output.hashtags.branded.length +
        output.hashtags.niche.length +
        output.hashtags.broad.length,
    });

    return output;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private extractAndValidate(
    response: Anthropic.Message,
    requestedPlatforms: Platform[],
    executionId: string,
  ): CopywriterOutput {
    const textBlock = response.content.find((b) => b.type === 'text');

    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Claude returned no text content block');
    }

    const cleaned = textBlock.text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      this.log('error', 'JSON parse failed', { executionId, raw: textBlock.text.slice(0, 300) });
      throw new Error('CopywriterAgent: Claude response is not valid JSON');
    }

    const output = this.assertValidOutput(parsed, requestedPlatforms);

    // Compute charCount for each platform copy in case Claude didn't
    for (const platform of requestedPlatforms) {
      const copy = output.copies[platform];
      if (copy) {
        copy.charCount = copy.caption.length;
      }
    }

    return output;
  }

  private assertValidOutput(
    value: unknown,
    requestedPlatforms: Platform[],
  ): CopywriterOutput {
    if (!value || typeof value !== 'object') {
      throw new Error('CopywriterAgent: Response is not an object');
    }

    const obj = value as Record<string, unknown>;

    // copies
    if (!obj.copies || typeof obj.copies !== 'object') {
      throw new Error('CopywriterAgent: Missing "copies" field');
    }
    for (const platform of requestedPlatforms) {
      const copy = (obj.copies as Record<string, unknown>)[platform];
      if (!copy || typeof copy !== 'object') {
        throw new Error(`CopywriterAgent: Missing copy for platform "${platform}"`);
      }
      if (typeof (copy as Record<string, unknown>).caption !== 'string') {
        throw new Error(`CopywriterAgent: copies.${platform}.caption must be a string`);
      }
    }

    // hashtags
    if (!obj.hashtags || typeof obj.hashtags !== 'object') {
      throw new Error('CopywriterAgent: Missing "hashtags" field');
    }
    const ht = obj.hashtags as Record<string, unknown>;
    for (const tier of ['branded', 'niche', 'broad'] as const) {
      if (!Array.isArray(ht[tier])) {
        throw new Error(`CopywriterAgent: hashtags.${tier} must be an array`);
      }
    }

    // scalar fields
    for (const field of ['callToAction', 'altText', 'strategySummary'] as const) {
      if (typeof obj[field] !== 'string') {
        throw new Error(`CopywriterAgent: "${field}" must be a string`);
      }
    }

    return obj as unknown as CopywriterOutput;
  }

  // ─── Convenience pipeline helper ──────────────────────────────────────────

  /**
   * Builds a `CopywriterInput` directly from the output of `EditorAgent`.
   * Shortcut for the common pipeline case.
   *
   * @example
   * const editorResult = await editorAgent.run(editorInput, ctx);
   * const copyInput = CopywriterAgent.fromEditorOutput(editorResult.data!, goal, platforms);
   * const copyResult = await copywriterAgent.run(copyInput, ctx);
   */
  static fromEditorOutput(
    editorOutput: { visualTags: string[]; analysis: import('../editor/types.js').ImageAnalysis },
    goal: CopywriterInput['goal'],
    platforms: Platform[],
    extras?: Pick<CopywriterInput, 'postContext' | 'product'>,
  ): CopywriterInput {
    return {
      visualTags: editorOutput.visualTags,
      imageAnalysis: editorOutput.analysis,
      goal,
      platforms,
      ...extras,
    };
  }

  /**
   * Returns a formatted hashtag string ready to append to a caption.
   * Instagram: all tiers (up to 15 tags).
   * Facebook: branded + niche only (up to 5 tags).
   *
   * @example
   * const tags = CopywriterAgent.formatHashtags(output.hashtags, 'instagram');
   * // "#HeladeriaPolar #HeladoArtesanal #Verano ..."
   */
  static formatHashtags(
    hashtags: CopywriterOutput['hashtags'],
    platform: Platform,
  ): string {
    const tags =
      platform === 'instagram'
        ? [...hashtags.branded, ...hashtags.niche, ...hashtags.broad].slice(0, 15)
        : [...hashtags.branded, ...hashtags.niche].slice(0, 5);

    return tags
      .map((t) => (t.startsWith('#') ? t : `#${t}`))
      .join(' ');
  }
}
