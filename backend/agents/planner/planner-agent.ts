// ─────────────────────────────────────────────────────────────────────────────
// Postly — PlannerAgent
//
// Generates a full monthly posting calendar from a list of content pieces.
// Applies sector-specific timing intelligence, detects public holidays,
// and returns ScheduledPost records ready to be enqueued in BullMQ.
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID } from 'crypto';
import type Anthropic from '@anthropic-ai/sdk';
import { BaseAgent } from '../shared/base-agent';
import { getClaudeClient, CLAUDE_MODEL, withRetry } from '../shared/claude-client';
import type { AgentContext } from '../shared/types';
import type { PlannerInput, PlannerOutput, ScheduledPost, CalendarDay } from './types';
import { buildPlannerSystemPrompt, buildPlannerUserPrompt } from './prompts';

export class PlannerAgent extends BaseAgent<PlannerInput, PlannerOutput> {
  constructor() {
    super('PlannerAgent');
  }

  // ─── Core execution ────────────────────────────────────────────────────────

  protected async execute(
    input: PlannerInput,
    context: AgentContext,
    executionId: string,
  ): Promise<PlannerOutput> {
    this.validateInput(input);

    this.log('info', 'Building calendar', {
      executionId,
      month: input.month,
      year: input.year,
      pieceCount: input.contentPieces.length,
      postsPerWeek: input.postsPerWeek,
    });

    const response = await withRetry(() =>
      getClaudeClient().messages.create({
        model: CLAUDE_MODEL,
        // Calendar output can be large — allow enough tokens for a full month
        max_tokens: 4096,
        system: buildPlannerSystemPrompt(context),
        messages: [
          {
            role: 'user',
            content: buildPlannerUserPrompt(input, context),
          },
        ],
      }),
    );

    const raw = this.extractAndValidate(response, executionId);
    const output = this.postProcess(raw, input);

    this.log('info', 'Calendar built', {
      executionId,
      scheduledCount: output.scheduledPosts.length,
      unscheduledCount: output.unscheduledPieceIds.length,
      holidayCount: output.calendar.filter((d) => d.isHoliday).length,
    });

    return output;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private validateInput(input: PlannerInput): void {
    if (input.month < 1 || input.month > 12) {
      throw new Error(`PlannerAgent: month must be 1–12, got ${input.month}`);
    }
    if (input.contentPieces.length === 0) {
      throw new Error('PlannerAgent: contentPieces cannot be empty');
    }
    if (input.postsPerWeek < 1 || input.postsPerWeek > 21) {
      throw new Error('PlannerAgent: postsPerWeek must be between 1 and 21');
    }
  }

  private extractAndValidate(response: Anthropic.Message, executionId: string): PlannerOutput {
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
      this.log('error', 'JSON parse failed', { executionId, raw: textBlock.text.slice(0, 400) });
      throw new Error('PlannerAgent: Claude response is not valid JSON');
    }

    this.assertValidOutput(parsed);
    return parsed as PlannerOutput;
  }

  /**
   * Ensures IDs exist on every ScheduledPost (Claude may omit them),
   * syncs the posts array inside each CalendarDay with scheduledPosts,
   * and sorts scheduledPosts by scheduledAt ascending.
   */
  private postProcess(output: PlannerOutput, input: PlannerInput): PlannerOutput {
    // Guarantee every ScheduledPost has an ID
    for (const post of output.scheduledPosts) {
      if (!post.id) post.id = randomUUID();
    }

    // Rebuild calendar.posts from the flat scheduledPosts list for consistency
    const postsByDate = new Map<string, ScheduledPost[]>();
    for (const post of output.scheduledPosts) {
      const existing = postsByDate.get(post.date) ?? [];
      existing.push(post);
      postsByDate.set(post.date, existing);
    }

    const rebuiltCalendar: CalendarDay[] = output.calendar.map((day) => ({
      ...day,
      posts: postsByDate.get(day.date) ?? [],
    }));

    // Sort scheduledPosts chronologically
    const sortedPosts = [...output.scheduledPosts].sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );

    // Carry forward month/year from input (Claude doesn't return them)
    return {
      month: input.month,
      year: input.year,
      calendar: rebuiltCalendar,
      scheduledPosts: sortedPosts,
      bestTimeInsights: output.bestTimeInsights,
      unscheduledPieceIds: output.unscheduledPieceIds,
      summary: output.summary,
    };
  }

  private assertValidOutput(value: unknown): asserts value is PlannerOutput {
    if (!value || typeof value !== 'object') {
      throw new Error('PlannerAgent: Response is not an object');
    }
    const obj = value as Record<string, unknown>;

    if (!Array.isArray(obj.calendar)) {
      throw new Error('PlannerAgent: "calendar" must be an array');
    }
    if (!Array.isArray(obj.scheduledPosts)) {
      throw new Error('PlannerAgent: "scheduledPosts" must be an array');
    }
    if (!Array.isArray(obj.bestTimeInsights)) {
      throw new Error('PlannerAgent: "bestTimeInsights" must be an array');
    }
    if (!Array.isArray(obj.unscheduledPieceIds)) {
      throw new Error('PlannerAgent: "unscheduledPieceIds" must be an array');
    }
    if (typeof obj.summary !== 'string') {
      throw new Error('PlannerAgent: "summary" must be a string');
    }

    // Spot-check first ScheduledPost if present
    if ((obj.scheduledPosts as unknown[]).length > 0) {
      const first = (obj.scheduledPosts as Record<string, unknown>[])[0]!;
      for (const field of ['contentPieceId', 'date', 'time', 'scheduledAt', 'platform'] as const) {
        if (typeof first[field] !== 'string') {
          throw new Error(`PlannerAgent: scheduledPosts[0].${field} must be a string`);
        }
      }
    }
  }

  // ─── Convenience helpers ───────────────────────────────────────────────────

  /**
   * Returns only the posts scheduled for a specific date.
   *
   * @example
   * const todayPosts = PlannerAgent.postsForDate(output, '2025-07-15');
   */
  static postsForDate(output: PlannerOutput, isoDate: string): ScheduledPost[] {
    return output.scheduledPosts.filter((p) => p.date === isoDate);
  }

  /**
   * Returns posts scheduled within the next N hours from a reference time.
   * Used by the BullMQ worker to batch-enqueue upcoming jobs.
   *
   * @param output   PlannerOutput to search
   * @param from     Reference datetime (default: now)
   * @param hours    Lookahead window (default: 24)
   */
  static upcomingPosts(
    output: PlannerOutput,
    from: Date = new Date(),
    hours = 24,
  ): ScheduledPost[] {
    const cutoff = new Date(from.getTime() + hours * 60 * 60 * 1000);
    return output.scheduledPosts.filter((p) => {
      const t = new Date(p.scheduledAt);
      return t >= from && t <= cutoff;
    });
  }

  /**
   * Checks whether all ContentPiece IDs were successfully scheduled.
   */
  static isFullyCovered(output: PlannerOutput): boolean {
    return output.unscheduledPieceIds.length === 0;
  }
}
