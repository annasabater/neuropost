// ─────────────────────────────────────────────────────────────────────────────
// Postly — BaseAgent
// Abstract class all agents extend. Handles execution lifecycle, error
// normalisation, and structured logging.
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID } from 'crypto';
import type { AgentContext, AgentResult, AgentError, AgentMetadata } from './types';

/**
 * Abstract base for all Postly agents.
 *
 * @template TInput  Shape of the data this agent consumes
 * @template TOutput Shape of the data this agent produces
 *
 * @example
 * class MyAgent extends BaseAgent<MyInput, MyOutput> {
 *   constructor() { super('MyAgent'); }
 *   protected async execute(input, context, executionId) { ... }
 * }
 */
export abstract class BaseAgent<TInput, TOutput> {
  protected readonly agentName: string;

  constructor(agentName: string) {
    this.agentName = agentName;
  }

  /**
   * Entry point for all agent invocations.
   * Wraps execute() with timing, logging, and error normalisation.
   */
  async run(input: TInput, context: AgentContext): Promise<AgentResult<TOutput>> {
    const executionId = randomUUID();
    const startTime = Date.now();

    this.log('info', 'Execution started', { executionId, businessId: context.businessId });

    try {
      const data = await this.execute(input, context, executionId);
      const durationMs = Date.now() - startTime;

      this.log('info', 'Execution completed', { executionId, durationMs });

      return {
        success: true,
        data,
        metadata: this.buildMetadata(executionId, durationMs),
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const agentError = this.normalizeError(error);

      this.log('error', 'Execution failed', {
        executionId,
        durationMs,
        errorCode: agentError.code,
        errorMessage: agentError.message,
      });

      return {
        success: false,
        error: agentError,
        metadata: this.buildMetadata(executionId, durationMs),
      };
    }
  }

  /**
   * Core logic implemented by each concrete agent.
   * Must throw on unrecoverable errors — BaseAgent handles the rest.
   */
  protected abstract execute(
    input: TInput,
    context: AgentContext,
    executionId: string,
  ): Promise<TOutput>;

  // ─── Helpers available to subclasses ───────────────────────────────────────

  protected log(
    level: 'info' | 'warn' | 'error',
    message: string,
    data?: Record<string, unknown>,
  ): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.agentName}]`;
    const payload = data ? JSON.stringify(data) : '';
    console[level](`${prefix} ${message} ${payload}`.trimEnd());
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private buildMetadata(executionId: string, durationMs: number): AgentMetadata {
    return {
      agentName: this.agentName,
      executionId,
      durationMs,
      timestamp: new Date().toISOString(),
    };
  }

  private normalizeError(error: unknown): AgentError {
    const message = error instanceof Error ? error.message : String(error);

    const isRateLimit = message.includes('rate_limit') || message.includes('529');
    const isNetwork =
      message.includes('ECONNRESET') ||
      message.includes('ETIMEDOUT') ||
      message.includes('ENOTFOUND');
    // Honour retryable flag from errors that carry it explicitly (e.g. MetaGraphError)
    const isExplicitlyRetryable =
      typeof (error as Record<string, unknown>)?.retryable === 'boolean' &&
      (error as Record<string, unknown>).retryable === true;

    return {
      code: isRateLimit ? 'RATE_LIMIT' : isNetwork ? 'NETWORK_ERROR' : 'EXECUTION_ERROR',
      message,
      retryable: isRateLimit || isNetwork || isExplicitlyRetryable,
    };
  }
}
