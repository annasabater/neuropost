// ─────────────────────────────────────────────────────────────────────────────
// Postly — IdeasAgent
//
// Generates creative, sector-specific post ideas with ready-to-publish captions.
// ─────────────────────────────────────────────────────────────────────────────

import { BaseAgent } from '../shared/base-agent';
import { getClaudeClient, CLAUDE_MODEL, withRetry } from '../shared/claude-client';
import type { AgentContext } from '../shared/types';
import type { IdeasInput, IdeasOutput, IdeaItem } from './types';
import { buildIdeasSystemPrompt, buildIdeasUserPrompt } from './prompts';

export class IdeasAgent extends BaseAgent<IdeasInput, IdeasOutput> {
  constructor() {
    super('IdeasAgent');
  }

  protected async execute(
    input: IdeasInput,
    context: AgentContext,
    executionId: string,
  ): Promise<IdeasOutput> {
    if (!input.prompt.trim()) {
      throw new Error('IdeasAgent: prompt cannot be empty');
    }

    const count = Math.min(Math.max(input.count, 1), 30);

    this.log('info', 'Generating ideas', { executionId, count, prompt: input.prompt.slice(0, 80) });

    const response = await withRetry(() =>
      getClaudeClient().messages.create({
        model:      CLAUDE_MODEL,
        max_tokens: 4096,
        system:     buildIdeasSystemPrompt(context),
        messages:   [{ role: 'user', content: buildIdeasUserPrompt({ ...input, count }) }],
      }),
    );

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('IdeasAgent: Claude returned no text block');
    }

    const cleaned = textBlock.text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      this.log('error', 'JSON parse failed', { executionId, raw: textBlock.text.slice(0, 200) });
      throw new Error('IdeasAgent: Claude response is not valid JSON');
    }

    const output = this.assertValidOutput(parsed, executionId);

    this.log('info', 'Ideas generated', { executionId, count: output.ideas.length });

    return output;
  }

  private assertValidOutput(value: unknown, executionId: string): IdeasOutput {
    const obj = value as Partial<IdeasOutput>;
    if (!Array.isArray(obj.ideas) || obj.ideas.length === 0) {
      this.log('error', 'Invalid output structure', { executionId });
      throw new Error('IdeasAgent: missing or empty "ideas" field');
    }
    const ideas: IdeaItem[] = obj.ideas.map((idea: Partial<IdeaItem>) => {
      if (!idea.title || !idea.caption) {
        throw new Error('IdeasAgent: idea missing required "title" or "caption"');
      }
      return {
        title:     idea.title,
        format:    idea.format    ?? 'image',
        caption:   idea.caption,
        hashtags:  idea.hashtags  ?? [],
        bestTime:  idea.bestTime  ?? '',
        rationale: idea.rationale ?? '',
        goal:      idea.goal      ?? 'engagement',
      };
    });
    return { ideas };
  }
}
