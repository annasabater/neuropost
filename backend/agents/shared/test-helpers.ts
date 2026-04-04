// ─────────────────────────────────────────────────────────────────────────────
// Postly — Shared test helpers
// Used by all agent test files.
// ─────────────────────────────────────────────────────────────────────────────

import { vi } from 'vitest';
import type { AgentContext } from './types';

// ─── Shared fixture ───────────────────────────────────────────────────────────

/**
 * Default AgentContext used across all agent tests.
 * Override individual fields with spread syntax when needed.
 */
export const mockContext: AgentContext = {
  businessId: 'biz-001',
  businessName: 'Heladería Polar',
  brandVoice: {
    tone: 'divertido',
    keywords: ['artesanal', 'fresco', 'natural'],
    forbiddenWords: ['barato', 'oferta'],
    sector: 'heladeria',
    language: 'es',
    exampleCaptions: ['¡El verano sabe mejor con nosotros!'],
  },
  socialAccounts: {
    instagramId: 'ig-12345',
    facebookPageId: 'fb-67890',
    accessToken: 'mock-token',
  },
  timezone: 'Europe/Madrid',
  subscriptionTier: 'pro',
};

// ─── Claude response factory ──────────────────────────────────────────────────

/**
 * Wraps a JSON-serialisable body in the minimal Claude API message shape
 * expected by all agents.
 */
export function makeClaudeResponse(body: unknown): { content: { type: string; text: string }[] } {
  return { content: [{ type: 'text', text: JSON.stringify(body) }] };
}

/**
 * Returns a Claude response where the text is wrapped in markdown code fences.
 * Used to verify that agents strip fences before JSON.parse().
 */
export function makeMarkdownResponse(body: unknown): { content: { type: string; text: string }[] } {
  return { content: [{ type: 'text', text: '```json\n' + JSON.stringify(body) + '\n```' }] };
}

/**
 * Returns a Claude response whose text is not valid JSON.
 * Used to verify error handling.
 */
export function makeInvalidJsonResponse(): { content: { type: string; text: string }[] } {
  return { content: [{ type: 'text', text: '{{bad' }] };
}

// ─── Mock client helpers ──────────────────────────────────────────────────────

/**
 * Points `getClaudeClient` at a mock that resolves with `response`.
 * Returns the inner `create` spy so callers can assert on it.
 *
 * Accepts a structurally-typed mock so it works with any `vi.mocked()`
 * result regardless of the underlying function's return type.
 *
 * Requires `getClaudeClient` to already be mocked via `vi.mock()`.
 */
export function mockClaudeClient(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getClaudeClientMock: { mockReturnValue: (val: any) => any },
  response: unknown,
): ReturnType<typeof vi.fn> {
  const create = vi.fn().mockResolvedValue(response);
  getClaudeClientMock.mockReturnValue({ messages: { create } });
  return create;
}
