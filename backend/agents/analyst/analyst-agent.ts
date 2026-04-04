// ─────────────────────────────────────────────────────────────────────────────
// Postly — AnalystAgent
//
// Consumes a month's worth of metrics from all pipeline stages and produces:
//   • A four-dimension scorecard (content / community / growth / execution)
//   • Top & low post highlights with performance factors
//   • Structured insights and actionable recommendations
//   • A full natural-language Markdown report for the dashboard
//
// This is the terminal agent in the pipeline — it reads from every other agent.
// ─────────────────────────────────────────────────────────────────────────────

import type Anthropic from '@anthropic-ai/sdk';
import { BaseAgent } from '../shared/base-agent.js';
import { getClaudeClient, CLAUDE_MODEL, withRetry } from '../shared/claude-client.js';
import type { AgentContext } from '../shared/types.js';
import type {
  AnalystInput,
  AnalystOutput,
  PostMetrics,
  PerformanceScores,
  PlatformBreakdown,
  PostHighlight,
} from './types.js';
import type { Platform } from '../copywriter/types.js';
import { buildAnalystSystemPrompt, buildAnalystUserPrompt } from './prompts.js';

export class AnalystAgent extends BaseAgent<AnalystInput, AnalystOutput> {
  constructor() {
    super('AnalystAgent');
  }

  // ─── Core execution ────────────────────────────────────────────────────────

  protected async execute(
    input: AnalystInput,
    context: AgentContext,
    executionId: string,
  ): Promise<AnalystOutput> {
    this.validateInput(input);

    this.log('info', 'Generating performance report', {
      executionId,
      period: `${input.period.year}-${String(input.period.month).padStart(2, '0')}`,
      postCount: input.postMetrics.length,
      hasPreviousPeriod: !!input.previousPeriod,
    });

    const response = await withRetry(() =>
      getClaudeClient().messages.create({
        model: CLAUDE_MODEL,
        // Report is ~600 words + JSON scaffolding; 4096 is comfortable
        max_tokens: 4096,
        system: buildAnalystSystemPrompt(context),
        messages: [
          { role: 'user', content: buildAnalystUserPrompt(input, context) },
        ],
      }),
    );

    const raw = this.extractAndValidate(response, executionId);
    const output = this.postProcess(raw, input);

    this.log('info', 'Report generated', {
      executionId,
      overallScore: output.scores.overall,
      topPostCount: output.topPosts.length,
      insightCount: output.insights.length,
      recommendationCount: output.recommendations.length,
    });

    return output;
  }

  // ─── Private: parse & validate ─────────────────────────────────────────────

  private extractAndValidate(response: Anthropic.Message, executionId: string): AnalystOutput {
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
      this.log('error', 'Report JSON parse failed', {
        executionId,
        raw: textBlock.text.slice(0, 400),
      });
      throw new Error('AnalystAgent: Claude response is not valid JSON');
    }

    this.assertValidOutput(parsed);
    return parsed as AnalystOutput;
  }

  private assertValidOutput(value: unknown): asserts value is AnalystOutput {
    if (!value || typeof value !== 'object') {
      throw new Error('AnalystAgent: Response is not an object');
    }
    const obj = value as Record<string, unknown>;

    if (!obj.scores || typeof obj.scores !== 'object') {
      throw new Error('AnalystAgent: "scores" must be an object');
    }
    const scores = obj.scores as Record<string, unknown>;
    for (const dim of ['overall', 'content', 'community', 'growth', 'execution'] as const) {
      if (typeof scores[dim] !== 'number') {
        throw new Error(`AnalystAgent: scores.${dim} must be a number`);
      }
    }

    if (!Array.isArray(obj.topPosts)) {
      throw new Error('AnalystAgent: "topPosts" must be an array');
    }
    if (!Array.isArray(obj.lowPosts)) {
      throw new Error('AnalystAgent: "lowPosts" must be an array');
    }
    if (!Array.isArray(obj.insights)) {
      throw new Error('AnalystAgent: "insights" must be an array');
    }
    if (!Array.isArray(obj.recommendations)) {
      throw new Error('AnalystAgent: "recommendations" must be an array');
    }
    if (typeof obj.report !== 'string' || obj.report.trim().length === 0) {
      throw new Error('AnalystAgent: "report" must be a non-empty string');
    }
  }

  // ─── Private: post-processing ──────────────────────────────────────────────

  /**
   * Adds fields that are derived from the input (not from Claude)
   * and stamps the generatedAt timestamp.
   */
  private postProcess(raw: AnalystOutput, input: AnalystInput): AnalystOutput {
    // Clamp all scores to 0–10
    const scores: PerformanceScores = {
      overall:   clamp(raw.scores.overall,   0, 10),
      content:   clamp(raw.scores.content,   0, 10),
      community: clamp(raw.scores.community, 0, 10),
      growth:    clamp(raw.scores.growth,    0, 10),
      execution: clamp(raw.scores.execution, 0, 10),
    };

    // If Claude didn't return platformBreakdowns, compute them from raw metrics
    const platformBreakdowns: PlatformBreakdown[] =
      Array.isArray(raw.platformBreakdowns) && raw.platformBreakdowns.length > 0
        ? raw.platformBreakdowns
        : this.computePlatformBreakdowns(input);

    // Ensure topPosts / lowPosts are capped to reasonable sizes
    const topPosts: PostHighlight[] = raw.topPosts.slice(0, 3);
    const lowPosts: PostHighlight[] = raw.lowPosts.slice(0, 2);

    return {
      period: input.period,
      scores,
      topPosts,
      lowPosts,
      insights: raw.insights,
      recommendations: raw.recommendations,
      platformBreakdowns,
      report: raw.report,
      generatedAt: new Date().toISOString(),
    };
  }

  private computePlatformBreakdowns(input: AnalystInput): PlatformBreakdown[] {
    const byPlatform = new Map<Platform, PostMetrics[]>();

    for (const post of input.postMetrics) {
      const group = byPlatform.get(post.platform) ?? [];
      group.push(post);
      byPlatform.set(post.platform, group);
    }

    return [...byPlatform.entries()].map(([platform, posts]) => {
      const avgEng =
        posts.length > 0
          ? posts.reduce((sum, p) => sum + p.engagementRate, 0) / posts.length
          : 0;
      const totalReach = posts.reduce((sum, p) => sum + p.reach, 0);

      const acct = input.accountMetrics.find((a) => a.platform === platform);

      return {
        platform,
        postCount: posts.length,
        avgEngagementRate: Math.round(avgEng * 10) / 10,
        totalReach,
        followersGained: acct?.followersGained ?? 0,
      };
    });
  }

  // ─── Input validation ──────────────────────────────────────────────────────

  private validateInput(input: AnalystInput): void {
    if (input.period.month < 1 || input.period.month > 12) {
      throw new Error(`AnalystAgent: month must be 1–12, got ${input.period.month}`);
    }
    if (input.postMetrics.length === 0) {
      throw new Error('AnalystAgent: postMetrics cannot be empty — nothing to analyse');
    }
    if (input.accountMetrics.length === 0) {
      throw new Error('AnalystAgent: accountMetrics cannot be empty');
    }
  }

  // ─── Static helpers ────────────────────────────────────────────────────────

  /**
   * Returns posts that underperformed the account average engagement rate.
   * Useful to surface learning opportunities in the dashboard.
   */
  static underperformers(postMetrics: PostMetrics[]): PostMetrics[] {
    if (postMetrics.length === 0) return [];
    const avgEng =
      postMetrics.reduce((s, p) => s + p.engagementRate, 0) / postMetrics.length;
    return postMetrics.filter((p) => p.engagementRate < avgEng * 0.7);
  }

  /**
   * Computes the month-over-month delta for a numeric metric.
   * Returns a signed percentage change, e.g. +12.5 or -4.2.
   *
   * @example
   * AnalystAgent.delta(4.2, 3.8) // +10.5 (%)
   */
  static delta(current: number, previous: number): number {
    if (previous === 0) return 0;
    return Math.round(((current - previous) / previous) * 1000) / 10;
  }

  /**
   * Derives a snapshot of this period's key metrics for use as
   * `previousPeriod` in next month's AnalystInput.
   *
   * @example
   * const snapshot = AnalystAgent.toSnapshot(output, input);
   * // Store in Supabase → pass as previousPeriod next month
   */
  static toSnapshot(
    output: AnalystOutput,
    input: AnalystInput,
  ): import('./types.js').PreviousPeriodSnapshot {
    const avgEng =
      input.postMetrics.length > 0
        ? input.postMetrics.reduce((s, p) => s + p.engagementRate, 0) /
          input.postMetrics.length
        : 0;
    const totalReach = input.postMetrics.reduce((s, p) => s + p.reach, 0);
    const followersGained = input.accountMetrics.reduce(
      (s, a) => s + a.followersGained,
      0,
    );

    return {
      avgEngagementRate: Math.round(avgEng * 10) / 10,
      totalReach,
      followersGained,
      sentimentScore: input.communityMetrics.sentimentScore,
      publishedPosts: input.plannerMetrics.publishedPosts,
    };
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}
