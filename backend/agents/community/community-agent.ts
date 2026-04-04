// ─────────────────────────────────────────────────────────────────────────────
// Postly — CommunityAgent
//
// Processes a batch of incoming comments/DMs in a single Claude call:
//   1. Classify each interaction (category, sentiment, priority, decision)
//   2. Generate brand-voice replies for those marked auto_respond
//   3. Optionally post replies to Meta Graph API
//   4. Return structured responses + a summary for the dashboard
//
// Max batch size: 20 interactions per call (enforced in validateInput).
// ─────────────────────────────────────────────────────────────────────────────

import type Anthropic from '@anthropic-ai/sdk';
import { BaseAgent } from '../shared/base-agent';
import { getClaudeClient, CLAUDE_MODEL, withRetry } from '../shared/claude-client';
import type { AgentContext } from '../shared/types';
import {
  replyToComment,
  sendDmReply,
  MetaGraphError,
} from '../../lib/meta-graph';
import type {
  CommunityInput,
  CommunityOutput,
  Interaction,
  InteractionResponse,
  CommunitySummary,
  SentimentBreakdown,
  CategoryBreakdown,
  InteractionAnalysis,
} from './types';
import { buildCommunitySystemPrompt, buildCommunityUserPrompt } from './prompts';

/** Maximum interactions per batch — prevents token overflow */
const MAX_BATCH_SIZE = 20;

// ─── Raw Claude response shape (before post-processing) ───────────────────────

interface RawClaudeResponse {
  responses: Array<{
    interactionId: string;
    analysis: InteractionAnalysis;
    generatedReply: string | null;
  }>;
  digest: string;
}

// ─── CommunityAgent ───────────────────────────────────────────────────────────

export class CommunityAgent extends BaseAgent<CommunityInput, CommunityOutput> {
  constructor() {
    super('CommunityAgent');
  }

  // ─── Core execution ────────────────────────────────────────────────────────

  protected async execute(
    input: CommunityInput,
    context: AgentContext,
    executionId: string,
  ): Promise<CommunityOutput> {
    this.validateInput(input);

    this.log('info', 'Processing interaction batch', {
      executionId,
      count: input.interactions.length,
      autoPost: input.autoPostReplies,
    });

    // 1. Classify + generate replies (single Claude call for the whole batch)
    const raw = await this.runBatchAnalysis(input, context, executionId);

    // 2. Build an id→interaction map for quick lookup during posting
    const interactionMap = new Map<string, Interaction>(
      input.interactions.map((it) => [it.id, it]),
    );

    // 3. Optionally post replies to Meta (errors are per-item, not fatal)
    const responses = await this.postReplies(
      raw.responses,
      interactionMap,
      input,
      context,
      executionId,
    );

    // 4. Build summary
    const summary = this.buildSummary(responses, raw.digest);

    this.log('info', 'Batch processing complete', {
      executionId,
      total: summary.total,
      autoResponded: summary.autoResponded,
      escalated: summary.escalated,
      repliesPosted: summary.repliesPosted,
      urgentCount: summary.urgentInteractionIds.length,
    });

    return { responses, summary };
  }

  // ─── Private: Claude batch call ────────────────────────────────────────────

  private async runBatchAnalysis(
    input: CommunityInput,
    context: AgentContext,
    executionId: string,
  ): Promise<RawClaudeResponse> {
    const response = await withRetry(() =>
      getClaudeClient().messages.create({
        model: CLAUDE_MODEL,
        // Each interaction can generate a reply (~150 tokens) + analysis (~100 tokens)
        max_tokens: Math.min(4096, input.interactions.length * 300 + 512),
        system: buildCommunitySystemPrompt(context),
        messages: [
          { role: 'user', content: buildCommunityUserPrompt(input, context) },
        ],
      }),
    );

    return this.parseClaudeResponse(response, executionId);
  }

  private parseClaudeResponse(
    response: Anthropic.Message,
    executionId: string,
  ): RawClaudeResponse {
    const textBlock = response.content.find((b) => b.type === 'text');

    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Claude returned no text block');
    }

    const cleaned = textBlock.text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      this.log('error', 'Batch JSON parse failed', {
        executionId,
        raw: textBlock.text.slice(0, 400),
      });
      throw new Error('CommunityAgent: Claude response is not valid JSON');
    }

    this.assertValidBatchResponse(parsed);
    return parsed as RawClaudeResponse;
  }

  private assertValidBatchResponse(value: unknown): asserts value is RawClaudeResponse {
    if (!value || typeof value !== 'object') {
      throw new Error('CommunityAgent: Response is not an object');
    }
    const obj = value as Record<string, unknown>;

    if (!Array.isArray(obj.responses)) {
      throw new Error('CommunityAgent: "responses" must be an array');
    }
    if (typeof obj.digest !== 'string') {
      throw new Error('CommunityAgent: "digest" must be a string');
    }

    // Spot-check first response item
    if (obj.responses.length > 0) {
      const first = (obj.responses as Record<string, unknown>[])[0]!;
      if (typeof first.interactionId !== 'string') {
        throw new Error('CommunityAgent: responses[0].interactionId must be a string');
      }
      if (!first.analysis || typeof first.analysis !== 'object') {
        throw new Error('CommunityAgent: responses[0].analysis must be an object');
      }
    }
  }

  // ─── Private: Meta reply posting ───────────────────────────────────────────

  /**
   * Iterates raw Claude responses and posts replies to Meta where applicable.
   * Posting failures are captured per-item and do NOT throw — the batch
   * result is always returned even if some posts fail.
   */
  private async postReplies(
    rawResponses: RawClaudeResponse['responses'],
    interactionMap: Map<string, Interaction>,
    input: CommunityInput,
    context: AgentContext,
    executionId: string,
  ): Promise<InteractionResponse[]> {
    const results: InteractionResponse[] = [];

    for (const raw of rawResponses) {
      const shouldPost =
        input.autoPostReplies &&
        raw.analysis.decision === 'auto_respond' &&
        raw.generatedReply != null;

      if (!shouldPost) {
        results.push({
          interactionId: raw.interactionId,
          analysis: raw.analysis,
          generatedReply: raw.generatedReply ?? '',
          replyPosted: false,
        });
        continue;
      }

      const interaction = interactionMap.get(raw.interactionId);
      if (!interaction) {
        this.log('warn', 'Interaction not found in map — skipping post', {
          executionId,
          interactionId: raw.interactionId,
        });
        results.push({
          interactionId: raw.interactionId,
          analysis: raw.analysis,
          generatedReply: raw.generatedReply ?? '',
          replyPosted: false,
          postingError: 'Interaction not found in input map',
        });
        continue;
      }

      const result = await this.postSingleReply(
        interaction,
        raw.generatedReply!,
        context,
        executionId,
      );

      results.push({
        interactionId: raw.interactionId,
        analysis: raw.analysis,
        generatedReply: raw.generatedReply!,
        ...result,
      });
    }

    return results;
  }

  private async postSingleReply(
    interaction: Interaction,
    reply: string,
    context: AgentContext,
    executionId: string,
  ): Promise<Pick<InteractionResponse, 'replyPosted' | 'metaReplyId' | 'postedAt' | 'postingError'>> {
    try {
      if (interaction.type === 'comment') {
        const res = await replyToComment({
          accessToken: context.socialAccounts.accessToken,
          commentId: interaction.id,
          message: reply,
        });

        this.log('info', 'Comment reply posted', {
          executionId,
          interactionId: interaction.id,
          replyId: res.replyId,
        });

        return { replyPosted: true, metaReplyId: res.replyId, postedAt: res.postedAt };
      }

      // DM
      const igAccountId = context.socialAccounts.instagramId;
      const res = await sendDmReply({
        accessToken: context.socialAccounts.accessToken,
        recipientId: interaction.authorId,
        message: reply,
        igAccountId: igAccountId!,
      });

      this.log('info', 'DM reply sent', {
        executionId,
        interactionId: interaction.id,
        replyId: res.replyId,
      });

      return { replyPosted: true, metaReplyId: res.replyId, postedAt: res.postedAt };
    } catch (err) {
      const message =
        err instanceof MetaGraphError
          ? `Meta API error ${err.code}: ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err);

      this.log('error', 'Reply posting failed', {
        executionId,
        interactionId: interaction.id,
        error: message,
      });

      return { replyPosted: false, postingError: message };
    }
  }

  // ─── Private: summary ──────────────────────────────────────────────────────

  private buildSummary(responses: InteractionResponse[], digest: string): CommunitySummary {
    const sentimentBreakdown: SentimentBreakdown = { positive: 0, neutral: 0, negative: 0 };
    const categoryBreakdown: CategoryBreakdown = {
      question: 0, complaint: 0, compliment: 0, spam: 0, general: 0, crisis: 0,
    };

    let autoResponded = 0;
    let escalated = 0;
    let ignored = 0;
    let repliesPosted = 0;
    const urgentInteractionIds: string[] = [];

    for (const r of responses) {
      const { decision, sentiment, category, priority } = r.analysis;

      sentimentBreakdown[sentiment]++;
      categoryBreakdown[category]++;

      if (decision === 'auto_respond') autoResponded++;
      else if (decision === 'escalate') escalated++;
      else ignored++;

      if (r.replyPosted) repliesPosted++;
      if (priority === 'urgent') urgentInteractionIds.push(r.interactionId);
    }

    return {
      total: responses.length,
      autoResponded,
      escalated,
      ignored,
      repliesPosted,
      sentimentBreakdown,
      categoryBreakdown,
      urgentInteractionIds,
      digest,
    };
  }

  // ─── Input validation ──────────────────────────────────────────────────────

  private validateInput(input: CommunityInput): void {
    if (input.interactions.length === 0) {
      throw new Error('CommunityAgent: interactions array cannot be empty');
    }
    if (input.interactions.length > MAX_BATCH_SIZE) {
      throw new Error(
        `CommunityAgent: batch size ${input.interactions.length} exceeds maximum of ${MAX_BATCH_SIZE}`,
      );
    }
  }

  // ─── Static helpers ────────────────────────────────────────────────────────

  /**
   * Filters a CommunityOutput down to interactions that need human attention.
   */
  static getEscalations(output: CommunityOutput): InteractionResponse[] {
    return output.responses.filter((r) => r.analysis.decision === 'escalate');
  }

  /**
   * Returns the overall sentiment ratio (0 = all negative, 1 = all positive).
   * Useful for the AnalystAgent's monthly report.
   */
  static sentimentScore(output: CommunityOutput): number {
    const { positive, neutral, negative } = output.summary.sentimentBreakdown;
    const total = positive + neutral + negative;
    if (total === 0) return 0.5;
    return (positive + neutral * 0.5) / total;
  }

  /**
   * Splits a large set of interactions into batches of MAX_BATCH_SIZE.
   * Use this before calling run() with more than 20 interactions.
   *
   * @example
   * const batches = CommunityAgent.batchInteractions(allInteractions);
   * const results = await Promise.all(batches.map(b => agent.run({ ...input, interactions: b }, ctx)));
   */
  static batchInteractions(
    interactions: Interaction[],
    batchSize = MAX_BATCH_SIZE,
  ): Interaction[][] {
    const batches: Interaction[][] = [];
    for (let i = 0; i < interactions.length; i += batchSize) {
      batches.push(interactions.slice(i, i + batchSize));
    }
    return batches;
  }
}
