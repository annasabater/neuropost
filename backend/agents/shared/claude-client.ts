// ─────────────────────────────────────────────────────────────────────────────
// Postly — Claude API client
// Singleton wrapper + exponential-backoff retry helper
// ─────────────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk';

/** Model used by all Postly agents */
export const CLAUDE_MODEL = 'claude-sonnet-4-20250514' as const;

let _client: Anthropic | null = null;

/**
 * Returns the shared Anthropic client instance.
 * Initialises lazily on first call.
 *
 * @throws If ANTHROPIC_API_KEY is not set in the environment
 */
export function getClaudeClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10_000,
};

/**
 * Executes `fn` with exponential backoff on retryable errors
 * (rate limits, network resets, 529 overloaded responses).
 *
 * @param fn    Async function to execute
 * @param config Override defaults when needed (e.g. tighter SLAs in tests)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<T> {
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      const retryable =
        lastError.message.includes('rate_limit') ||
        lastError.message.includes('529') ||
        lastError.message.includes('ECONNRESET') ||
        lastError.message.includes('ETIMEDOUT');

      if (!retryable || attempt === config.maxRetries - 1) {
        throw lastError;
      }

      const delay = Math.min(
        config.initialDelayMs * Math.pow(2, attempt),
        config.maxDelayMs,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
