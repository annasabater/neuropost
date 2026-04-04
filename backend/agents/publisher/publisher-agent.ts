// ─────────────────────────────────────────────────────────────────────────────
// Postly — PublisherAgent
//
// Orchestrates the full publish pipeline for a single post:
//   1. Assemble final caption (copy + hashtags per platform rules)
//   2. Run Claude brand-safety check
//   3a. Block → return 'rejected'
//   3b. Requires approval → store pending record, return 'pending_approval'
//   3c. Clear → call Meta Graph API, return 'published'
//
// Meta API calls are delegated to lib/meta-graph.ts.
// Approval records are written to Supabase (injected via constructor for DI).
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID } from 'crypto';
import type Anthropic from '@anthropic-ai/sdk';
import { BaseAgent } from '../shared/base-agent';
import { getClaudeClient, CLAUDE_MODEL, withRetry } from '../shared/claude-client';
import type { AgentContext } from '../shared/types';
import {
  publishToInstagram,
  publishToFacebook,
  MetaGraphError,
} from '../../lib/meta-graph';
import type { PublisherInput, PublisherOutput, BrandSafetyCheck } from './types';
import { buildSafetySystemPrompt, buildSafetyUserPrompt } from './prompts';

// ─── Approval store interface (injectable for testing) ────────────────────────

export interface ApprovalStore {
  createPendingApproval(record: {
    id: string;
    contentPieceId: string;
    platform: string;
    finalCaption: string;
    imageUrl: string;
    scheduledAt: string;
    safetyScore: number;
    createdAt: string;
  }): Promise<void>;
}

/** No-op store used when no real store is injected (e.g. in tests) */
export class NoopApprovalStore implements ApprovalStore {
  async createPendingApproval(): Promise<void> {
    // intentionally empty
  }
}

// ─── PublisherAgent ───────────────────────────────────────────────────────────

export class PublisherAgent extends BaseAgent<PublisherInput, PublisherOutput> {
  private readonly approvalStore: ApprovalStore;

  constructor(approvalStore: ApprovalStore = new NoopApprovalStore()) {
    super('PublisherAgent');
    this.approvalStore = approvalStore;
  }

  // ─── Core execution ────────────────────────────────────────────────────────

  protected async execute(
    input: PublisherInput,
    context: AgentContext,
    executionId: string,
  ): Promise<PublisherOutput> {
    // 1. Assemble final caption (platform-specific hashtag placement)
    const finalCaption = this.assembleFinalCaption(input);

    this.log('info', 'Running brand safety check', {
      executionId,
      platform: input.platform,
      captionLength: finalCaption.length,
    });

    // 2. Brand safety check
    const safetyCheck = await this.runSafetyCheck(input, finalCaption, context, executionId);

    this.log('info', 'Safety check complete', {
      executionId,
      score: safetyCheck.score,
      recommendation: safetyCheck.recommendation,
    });

    // 3a. Block
    if (safetyCheck.recommendation === 'block') {
      return {
        status: 'rejected',
        brandSafetyCheck: safetyCheck,
        failureReason: safetyCheck.explanation,
        finalCaption,
      };
    }

    // 3b. Pending approval
    const requiresApproval = this.resolveRequiresApproval(input, context);
    if (requiresApproval || safetyCheck.recommendation === 'review') {
      const approvalRequestId = randomUUID();

      await this.approvalStore.createPendingApproval({
        id: approvalRequestId,
        contentPieceId: input.contentPieceId,
        platform: input.platform,
        finalCaption,
        imageUrl: input.imageUrl,
        scheduledAt: input.scheduledAt,
        safetyScore: safetyCheck.score,
        createdAt: new Date().toISOString(),
      });

      this.log('info', 'Approval request created', { executionId, approvalRequestId });

      return {
        status: 'pending_approval',
        brandSafetyCheck: safetyCheck,
        approvalRequestId,
        finalCaption,
      };
    }

    // 3c. Publish to Meta
    return this.publishToMeta(input, finalCaption, safetyCheck, context, executionId);
  }

  // ─── Private: caption assembly ─────────────────────────────────────────────

  /**
   * Applies platform-specific hashtag placement rules:
   * - Instagram: two line breaks between caption body and hashtags
   * - Facebook: no hashtags appended (they stay off-caption)
   */
  private assembleFinalCaption(input: PublisherInput): string {
    if (input.platform === 'instagram' && input.hashtags.trim()) {
      return `${input.caption}\n\n${input.hashtags}`;
    }
    return input.caption;
  }

  // ─── Private: brand safety ─────────────────────────────────────────────────

  private async runSafetyCheck(
    input: PublisherInput,
    finalCaption: string,
    context: AgentContext,
    executionId: string,
  ): Promise<BrandSafetyCheck> {
    const response = await withRetry(() =>
      getClaudeClient().messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 512,
        system: buildSafetySystemPrompt(context),
        messages: [
          { role: 'user', content: buildSafetyUserPrompt(input, finalCaption) },
        ],
      }),
    );

    return this.parseSafetyCheck(response, executionId);
  }

  private parseSafetyCheck(response: Anthropic.Message, executionId: string): BrandSafetyCheck {
    const textBlock = response.content.find((b) => b.type === 'text');

    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Claude returned no text block for safety check');
    }

    const cleaned = textBlock.text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      this.log('error', 'Safety check JSON parse failed', {
        executionId,
        raw: textBlock.text.slice(0, 300),
      });
      throw new Error('PublisherAgent: Safety check response is not valid JSON');
    }

    this.assertValidSafetyCheck(parsed);
    return parsed as BrandSafetyCheck;
  }

  private assertValidSafetyCheck(value: unknown): asserts value is BrandSafetyCheck {
    if (!value || typeof value !== 'object') {
      throw new Error('PublisherAgent: Safety check response is not an object');
    }
    const obj = value as Record<string, unknown>;

    if (typeof obj.passed !== 'boolean') {
      throw new Error('PublisherAgent: safety.passed must be boolean');
    }
    if (typeof obj.score !== 'number') {
      throw new Error('PublisherAgent: safety.score must be a number');
    }
    if (!['publish', 'review', 'block'].includes(obj.recommendation as string)) {
      throw new Error('PublisherAgent: safety.recommendation is invalid');
    }
    if (!Array.isArray(obj.issues)) {
      throw new Error('PublisherAgent: safety.issues must be an array');
    }
  }

  // ─── Private: Meta publish ─────────────────────────────────────────────────

  private async publishToMeta(
    input: PublisherInput,
    finalCaption: string,
    safetyCheck: BrandSafetyCheck,
    context: AgentContext,
    executionId: string,
  ): Promise<PublisherOutput> {
    const params = {
      accessToken: context.socialAccounts.accessToken,
      accountId:
        input.platform === 'instagram'
          ? (context.socialAccounts.instagramId ?? '')
          : (context.socialAccounts.facebookPageId ?? ''),
      imageUrl: input.imageUrl,
      caption: finalCaption,
      altText: input.altText,
    };

    if (!params.accountId) {
      throw new Error(
        `PublisherAgent: No ${input.platform} account ID in context for business ${context.businessId}`,
      );
    }

    this.log('info', 'Calling Meta Graph API', { executionId, platform: input.platform });

    try {
      const metaResult =
        input.platform === 'instagram'
          ? await publishToInstagram(params)
          : await publishToFacebook(params);

      this.log('info', 'Published successfully', {
        executionId,
        platform: input.platform,
        metaPostId: metaResult.postId,
      });

      return {
        status: 'published',
        brandSafetyCheck: safetyCheck,
        metaPostId: metaResult.postId,
        metaPermalink: metaResult.permalink,
        publishedAt: metaResult.publishedAt,
        finalCaption,
      };
    } catch (err) {
      if (err instanceof MetaGraphError) {
        this.log('error', 'Meta Graph API error', {
          executionId,
          code: err.code,
          retryable: err.retryable,
          message: err.message,
        });

        // Re-throw retryable errors so BaseAgent marks them correctly
        if (err.retryable) throw err;

        return {
          status: 'failed',
          brandSafetyCheck: safetyCheck,
          failureReason: `Meta API error ${err.code}: ${err.message}`,
          finalCaption,
        };
      }
      throw err;
    }
  }

  // ─── Private: approval resolution ─────────────────────────────────────────

  /**
   * Determines whether this post needs human approval.
   * - Explicit input flag takes precedence
   * - 'starter' tier always requires approval
   * - 'pro' / 'agency' default to auto-publish (input can override)
   */
  private resolveRequiresApproval(input: PublisherInput, context: AgentContext): boolean {
    if (input.requiresApproval !== undefined) return input.requiresApproval;
    return context.subscriptionTier === 'starter';
  }
}
