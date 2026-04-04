// ─────────────────────────────────────────────────────────────────────────────
// Postly — EditorAgent
//
// Analyses a photo with Claude Vision and returns structured editing metadata.
// Does NOT apply edits itself — callers use the returned EditingParameters
// with a library like Sharp to perform the actual image transforms.
// ─────────────────────────────────────────────────────────────────────────────

import type Anthropic from '@anthropic-ai/sdk';
import { BaseAgent } from '../shared/base-agent.js';
import { getClaudeClient, CLAUDE_MODEL, withRetry } from '../shared/claude-client.js';
import type { AgentContext } from '../shared/types.js';
import type { EditorInput, EditorOutput } from './types.js';
import { buildEditorSystemPrompt, buildEditorUserPrompt } from './prompts.js';

export class EditorAgent extends BaseAgent<EditorInput, EditorOutput> {
  constructor() {
    super('EditorAgent');
  }

  // ─── Core execution ────────────────────────────────────────────────────────

  protected async execute(
    input: EditorInput,
    context: AgentContext,
    executionId: string,
  ): Promise<EditorOutput> {
    this.log('info', 'Analysing image', {
      executionId,
      level: input.editingLevel,
      imageType: input.imageType,
    });

    const response = await withRetry(() =>
      getClaudeClient().messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        system: buildEditorSystemPrompt(context),
        messages: [
          {
            role: 'user',
            content: [
              this.buildImageBlock(input),
              { type: 'text', text: buildEditorUserPrompt(input.editingLevel, input.photoContext) },
            ],
          },
        ],
      }),
    );

    const output = this.extractAndValidate(response, executionId);

    this.log('info', 'Analysis complete', {
      executionId,
      isSuitable: output.analysis.isSuitable,
      qualityScore: output.analysis.qualityScore,
      visualTagCount: output.visualTags.length,
    });

    return output;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Builds the Claude Vision image content block.
   * Supports both public URLs and raw base64 data.
   */
  private buildImageBlock(
    input: EditorInput,
  ): Anthropic.ImageBlockParam {
    if (input.imageType === 'url') {
      return {
        type: 'image',
        source: { type: 'url', url: input.image },
      };
    }

    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: input.mimeType,
        data: input.image,
      },
    };
  }

  /**
   * Extracts the text block from Claude's response, parses JSON,
   * and validates the minimum required fields.
   */
  private extractAndValidate(
    response: Anthropic.Message,
    executionId: string,
  ): EditorOutput {
    const textBlock = response.content.find((b) => b.type === 'text');

    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Claude returned no text content block');
    }

    // Strip markdown code fences Claude sometimes wraps JSON with
    const cleaned = textBlock.text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      this.log('error', 'JSON parse failed', { executionId, raw: textBlock.text.slice(0, 200) });
      throw new Error('EditorAgent: Claude response is not valid JSON');
    }

    this.assertValidOutput(parsed);

    return parsed as EditorOutput;
  }

  /**
   * Minimal structural validation — enough to catch prompt-injection
   * or unexpected Claude output formats before passing data downstream.
   */
  private assertValidOutput(value: unknown): asserts value is EditorOutput {
    if (!value || typeof value !== 'object') {
      throw new Error('EditorAgent: Response is not an object');
    }

    const obj = value as Record<string, unknown>;

    if (!obj.analysis || typeof obj.analysis !== 'object') {
      throw new Error('EditorAgent: Missing "analysis" field');
    }

    const analysis = obj.analysis as Record<string, unknown>;

    if (typeof analysis.qualityScore !== 'number') {
      throw new Error('EditorAgent: analysis.qualityScore must be a number');
    }

    if (typeof analysis.isSuitable !== 'boolean') {
      throw new Error('EditorAgent: analysis.isSuitable must be a boolean');
    }

    if (!Array.isArray(obj.visualTags)) {
      throw new Error('EditorAgent: "visualTags" must be an array');
    }
  }
}
