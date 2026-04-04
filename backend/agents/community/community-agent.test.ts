// ─────────────────────────────────────────────────────────────────────────────
// Postly — CommunityAgent unit tests
// Run with: npx vitest backend/agents/community
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommunityAgent } from './community-agent.js';
import type { CommunityInput, Interaction, InteractionAnalysis } from './types.js';
import {
  mockContext,
  makeClaudeResponse,
  makeMarkdownResponse,
  makeInvalidJsonResponse,
  mockClaudeClient,
} from '../shared/test-helpers';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../shared/claude-client', () => ({
  getClaudeClient: vi.fn(),
  CLAUDE_MODEL: 'claude-sonnet-4-20250514',
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

vi.mock('../../lib/meta-graph', () => ({
  replyToComment: vi.fn(),
  sendDmReply: vi.fn(),
  MetaGraphError: class MetaGraphError extends Error {
    constructor(
      message: string,
      public code: number,
      public subcode?: number,
      public retryable = false,
    ) {
      super(message);
      this.name = 'MetaGraphError';
    }
  },
}));

// Hoisted references to mocked exports — avoids repeated dynamic imports
import { getClaudeClient, withRetry } from '../shared/claude-client';
import { replyToComment, sendDmReply, MetaGraphError } from '../../lib/meta-graph';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const commentInteraction: Interaction = {
  id: 'comment-001',
  type: 'comment',
  platform: 'instagram',
  authorId: 'user-abc',
  authorName: 'María López',
  text: '¿A qué hora abrís los domingos? 🍦',
  timestamp: '2025-07-03T15:30:00.000Z',
  postId: 'post-xyz',
};

const complimentInteraction: Interaction = {
  id: 'comment-002',
  type: 'comment',
  platform: 'facebook',
  authorId: 'user-def',
  authorName: 'Carlos Ruiz',
  text: '¡El mejor helado de la ciudad! Repetiremos seguro.',
  timestamp: '2025-07-03T16:00:00.000Z',
  postId: 'post-xyz',
};

const complaintInteraction: Interaction = {
  id: 'comment-003',
  type: 'comment',
  platform: 'instagram',
  authorId: 'user-ghi',
  authorName: 'Pedro Sanz',
  text: 'Qué asco, me encontré un pelo en el helado. Esto es una vergüenza.',
  timestamp: '2025-07-03T17:00:00.000Z',
  postId: 'post-xyz',
};

const spamInteraction: Interaction = {
  id: 'comment-004',
  type: 'comment',
  platform: 'instagram',
  authorId: 'user-spam',
  authorName: 'CryptoBot99',
  text: 'Make money fast! Click my link in bio for 1000% returns guaranteed!!!',
  timestamp: '2025-07-03T17:30:00.000Z',
  postId: 'post-xyz',
};

const dmInteraction: Interaction = {
  id: 'dm-001',
  type: 'dm',
  platform: 'instagram',
  authorId: 'user-jkl',
  authorName: 'Laura Gómez',
  text: 'Hola! ¿Tenéis sabores sin azúcar? Soy diabética.',
  timestamp: '2025-07-03T18:00:00.000Z',
};

const mockInput: CommunityInput = {
  interactions: [commentInteraction, complimentInteraction, complaintInteraction, spamInteraction, dmInteraction],
  autoPostReplies: false,
};

// ─── Mock Claude response factory ─────────────────────────────────────────────

function makeAnalysis(overrides: Partial<InteractionAnalysis> = {}): InteractionAnalysis {
  return {
    category: 'question',
    sentiment: 'neutral',
    priority: 'normal',
    decision: 'auto_respond',
    escalationReason: undefined,
    detectedLanguage: 'es',
    containsSensitiveContent: false,
    keywords: ['horario', 'domingo'],
    ...overrides,
  };
}

function makeClaudeOutput(responses: Array<{ id: string; analysis: Partial<InteractionAnalysis>; reply?: string | null }>) {
  return {
    responses: responses.map((r) => ({
      interactionId: r.id,
      analysis: makeAnalysis(r.analysis),
      generatedReply: r.reply !== undefined ? r.reply : 'Hola, estamos encantados de ayudarte!',
    })),
    digest: 'Cinco interacciones procesadas. Una escalación por queja. Alta satisfacción general.',
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setClaudeResponse(body: unknown) {
  mockClaudeClient(vi.mocked(getClaudeClient), makeClaudeResponse(body));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CommunityAgent', () => {
  let agent: CommunityAgent;

  beforeEach(() => {
    agent = new CommunityAgent();
    vi.clearAllMocks();
    vi.mocked(withRetry).mockImplementation((fn: () => Promise<unknown>) => fn());
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it('returns a response for every interaction in the batch', async () => {
    const claudeBody = makeClaudeOutput([
      { id: 'comment-001', analysis: { category: 'question', decision: 'auto_respond' } },
      { id: 'comment-002', analysis: { category: 'compliment', sentiment: 'positive', decision: 'auto_respond' } },
      { id: 'comment-003', analysis: { category: 'complaint', sentiment: 'negative', decision: 'escalate', priority: 'urgent' }, reply: null },
      { id: 'comment-004', analysis: { category: 'spam', decision: 'ignore', priority: 'low' }, reply: null },
      { id: 'dm-001',      analysis: { category: 'question', decision: 'auto_respond' } },
    ]);
    setClaudeResponse(claudeBody);

    const result = await agent.run(mockInput, mockContext);

    expect(result.success).toBe(true);
    expect(result.data?.responses).toHaveLength(5);
  });

  it('sets replyPosted=false when autoPostReplies is false', async () => {
    const claudeBody = makeClaudeOutput([
      { id: 'comment-001', analysis: { decision: 'auto_respond' } },
      { id: 'comment-002', analysis: { decision: 'auto_respond', category: 'compliment', sentiment: 'positive' } },
      { id: 'comment-003', analysis: { decision: 'escalate', category: 'complaint', sentiment: 'negative', priority: 'urgent' }, reply: null },
      { id: 'comment-004', analysis: { decision: 'ignore', category: 'spam', priority: 'low' }, reply: null },
      { id: 'dm-001',      analysis: { decision: 'auto_respond' } },
    ]);
    setClaudeResponse(claudeBody);

    const result = await agent.run(mockInput, mockContext);

    expect(result.data?.responses.every((r) => !r.replyPosted)).toBe(true);
  });

  it('builds correct summary counts', async () => {
    const claudeBody = makeClaudeOutput([
      { id: 'comment-001', analysis: { decision: 'auto_respond', sentiment: 'neutral', category: 'question', priority: 'normal' } },
      { id: 'comment-002', analysis: { decision: 'auto_respond', sentiment: 'positive', category: 'compliment', priority: 'normal' } },
      { id: 'comment-003', analysis: { decision: 'escalate',     sentiment: 'negative', category: 'complaint', priority: 'urgent' }, reply: null },
      { id: 'comment-004', analysis: { decision: 'ignore',       sentiment: 'neutral',  category: 'spam',      priority: 'low' }, reply: null },
      { id: 'dm-001',      analysis: { decision: 'auto_respond', sentiment: 'neutral',  category: 'question',  priority: 'normal' } },
    ]);
    setClaudeResponse(claudeBody);

    const result = await agent.run(mockInput, mockContext);
    const s = result.data!.summary;

    expect(s.total).toBe(5);
    expect(s.autoResponded).toBe(3);
    expect(s.escalated).toBe(1);
    expect(s.ignored).toBe(1);
    expect(s.urgentInteractionIds).toContain('comment-003');
  });

  it('builds correct sentiment breakdown', async () => {
    const claudeBody = makeClaudeOutput([
      { id: 'comment-001', analysis: { sentiment: 'positive', decision: 'auto_respond' } },
      { id: 'comment-002', analysis: { sentiment: 'positive', decision: 'auto_respond', category: 'compliment' } },
      { id: 'comment-003', analysis: { sentiment: 'negative', decision: 'escalate', category: 'complaint', priority: 'urgent' }, reply: null },
      { id: 'comment-004', analysis: { sentiment: 'neutral',  decision: 'ignore', category: 'spam', priority: 'low' }, reply: null },
      { id: 'dm-001',      analysis: { sentiment: 'neutral',  decision: 'auto_respond' } },
    ]);
    setClaudeResponse(claudeBody);

    const result = await agent.run(mockInput, mockContext);
    const { sentimentBreakdown } = result.data!.summary;

    expect(sentimentBreakdown.positive).toBe(2);
    expect(sentimentBreakdown.negative).toBe(1);
    expect(sentimentBreakdown.neutral).toBe(2);
  });

  it('includes digest in summary', async () => {
    const claudeBody = makeClaudeOutput([
      { id: 'comment-001', analysis: {} },
      { id: 'comment-002', analysis: { category: 'compliment', sentiment: 'positive' } },
      { id: 'comment-003', analysis: { decision: 'escalate', category: 'complaint', sentiment: 'negative', priority: 'urgent' }, reply: null },
      { id: 'comment-004', analysis: { decision: 'ignore', category: 'spam', priority: 'low' }, reply: null },
      { id: 'dm-001',      analysis: {} },
    ]);
    setClaudeResponse(claudeBody);

    const result = await agent.run(mockInput, mockContext);

    expect(typeof result.data?.summary.digest).toBe('string');
    expect(result.data?.summary.digest.length).toBeGreaterThan(0);
  });

  // ── Auto-posting ────────────────────────────────────────────────────────────

  it('posts comment replies when autoPostReplies is true', async () => {
    const claudeBody = makeClaudeOutput([
      { id: 'comment-001', analysis: { decision: 'auto_respond' }, reply: '¡Abrimos los domingos a las 11h! 🍦' },
      { id: 'comment-002', analysis: { decision: 'auto_respond', category: 'compliment', sentiment: 'positive' }, reply: '¡Gracias Carlos!' },
      { id: 'comment-003', analysis: { decision: 'escalate', category: 'complaint', sentiment: 'negative', priority: 'urgent' }, reply: null },
      { id: 'comment-004', analysis: { decision: 'ignore', category: 'spam', priority: 'low' }, reply: null },
      { id: 'dm-001',      analysis: { decision: 'auto_respond' }, reply: 'Hola Laura, sí tenemos opciones sin azúcar.' },
    ]);
    setClaudeResponse(claudeBody);
    vi.mocked(replyToComment).mockResolvedValue({ replyId: 'reply-meta-001', postedAt: '2025-07-03T15:35:00.000Z' });
    vi.mocked(sendDmReply).mockResolvedValue({ replyId: 'dm-meta-001', postedAt: '2025-07-03T18:05:00.000Z' });

    const result = await agent.run({ ...mockInput, autoPostReplies: true }, mockContext);

    expect(vi.mocked(replyToComment)).toHaveBeenCalledTimes(2); // 2 comments auto_respond
    expect(vi.mocked(sendDmReply)).toHaveBeenCalledTimes(1);    // 1 DM auto_respond
    expect(result.data?.summary.repliesPosted).toBe(3);
  });

  it('does not post replies for escalate or ignore decisions', async () => {
    const claudeBody = makeClaudeOutput([
      { id: 'comment-001', analysis: { decision: 'escalate', category: 'complaint', sentiment: 'negative', priority: 'urgent' }, reply: null },
      { id: 'comment-002', analysis: { decision: 'ignore', category: 'spam', priority: 'low' }, reply: null },
      { id: 'comment-003', analysis: { decision: 'auto_respond', category: 'compliment', sentiment: 'positive' } },
      { id: 'comment-004', analysis: { decision: 'auto_respond', category: 'question' } },
      { id: 'dm-001',      analysis: { decision: 'escalate', category: 'question', priority: 'normal' }, reply: null },
    ]);
    setClaudeResponse(claudeBody);
    vi.mocked(replyToComment).mockResolvedValue({ replyId: 'r1', postedAt: '' });

    await agent.run({ ...mockInput, autoPostReplies: true }, mockContext);

    expect(vi.mocked(replyToComment)).toHaveBeenCalledTimes(2); // only the 2 auto_respond comments
  });

  it('captures posting errors per-item without failing the whole batch', async () => {
    const claudeBody = makeClaudeOutput([
      { id: 'comment-001', analysis: { decision: 'auto_respond' }, reply: 'Reply 1' },
      { id: 'comment-002', analysis: { decision: 'auto_respond', category: 'compliment', sentiment: 'positive' }, reply: 'Reply 2' },
      { id: 'comment-003', analysis: { decision: 'escalate', category: 'complaint', sentiment: 'negative', priority: 'urgent' }, reply: null },
      { id: 'comment-004', analysis: { decision: 'ignore', category: 'spam', priority: 'low' }, reply: null },
      { id: 'dm-001',      analysis: { decision: 'auto_respond' }, reply: 'Reply DM' },
    ]);
    setClaudeResponse(claudeBody);
    vi.mocked(replyToComment).mockRejectedValue(
      new MetaGraphError('Token expired', 190, undefined, false),
    );

    const result = await agent.run({ ...mockInput, autoPostReplies: true }, mockContext);

    expect(result.success).toBe(true); // batch succeeds despite posting errors
    const failedPost = result.data?.responses.find((r) => r.interactionId === 'comment-001');
    expect(failedPost?.replyPosted).toBe(false);
    expect(failedPost?.postingError).toContain('190');
  });

  // ── Input validation ────────────────────────────────────────────────────────

  it('returns error for empty interactions array', async () => {
    const result = await agent.run({ ...mockInput, interactions: [] }, mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/empty/);
  });

  it('returns error when batch exceeds 20 interactions', async () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => ({
      ...commentInteraction,
      id: `comment-${i}`,
    }));
    const result = await agent.run({ ...mockInput, interactions: tooMany }, mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/maximum/i);
  });

  // ── Error handling ──────────────────────────────────────────────────────────

  it('returns error when Claude response is not valid JSON', async () => {
    mockClaudeClient(vi.mocked(getClaudeClient), makeInvalidJsonResponse());

    const result = await agent.run(mockInput, mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('EXECUTION_ERROR');
  });

  it('marks rate-limit errors as retryable', async () => {
    vi.mocked(withRetry).mockRejectedValue(new Error('rate_limit exceeded'));

    const result = await agent.run(mockInput, mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.retryable).toBe(true);
  });

  it('strips markdown code fences', async () => {
    const claudeBody = makeClaudeOutput([
      { id: 'comment-001', analysis: {} },
      { id: 'comment-002', analysis: { category: 'compliment', sentiment: 'positive' } },
      { id: 'comment-003', analysis: { decision: 'escalate', category: 'complaint', sentiment: 'negative', priority: 'urgent' }, reply: null },
      { id: 'comment-004', analysis: { decision: 'ignore', category: 'spam', priority: 'low' }, reply: null },
      { id: 'dm-001',      analysis: {} },
    ]);
    mockClaudeClient(vi.mocked(getClaudeClient), makeMarkdownResponse(claudeBody));

    const result = await agent.run(mockInput, mockContext);

    expect(result.success).toBe(true);
  });

  // ── Static helpers ──────────────────────────────────────────────────────────

  describe('CommunityAgent.getEscalations()', () => {
    it('returns only escalated responses', async () => {
      const claudeBody = makeClaudeOutput([
        { id: 'comment-001', analysis: { decision: 'auto_respond' } },
        { id: 'comment-002', analysis: { decision: 'escalate', category: 'complaint', sentiment: 'negative', priority: 'urgent' }, reply: null },
        { id: 'comment-003', analysis: { decision: 'ignore', category: 'spam', priority: 'low' }, reply: null },
        { id: 'comment-004', analysis: { decision: 'auto_respond', category: 'compliment', sentiment: 'positive' } },
        { id: 'dm-001',      analysis: { decision: 'auto_respond' } },
      ]);
      setClaudeResponse(claudeBody);

      const result = await agent.run(mockInput, mockContext);
      const escalations = CommunityAgent.getEscalations(result.data!);

      expect(escalations.every((r) => r.analysis.decision === 'escalate')).toBe(true);
    });
  });

  describe('CommunityAgent.sentimentScore()', () => {
    it('returns 1.0 when all interactions are positive', async () => {
      const claudeBody = makeClaudeOutput([
        { id: 'comment-001', analysis: { sentiment: 'positive', decision: 'auto_respond' } },
        { id: 'comment-002', analysis: { sentiment: 'positive', decision: 'auto_respond', category: 'compliment' } },
        { id: 'comment-003', analysis: { sentiment: 'positive', decision: 'auto_respond', category: 'compliment' } },
        { id: 'comment-004', analysis: { sentiment: 'positive', decision: 'auto_respond', category: 'compliment' } },
        { id: 'dm-001',      analysis: { sentiment: 'positive', decision: 'auto_respond' } },
      ]);
      setClaudeResponse(claudeBody);

      const result = await agent.run(mockInput, mockContext);
      expect(CommunityAgent.sentimentScore(result.data!)).toBe(1.0);
    });

    it('returns 0.0 when all interactions are negative', async () => {
      const claudeBody = makeClaudeOutput([
        { id: 'comment-001', analysis: { sentiment: 'negative', decision: 'escalate', category: 'complaint', priority: 'urgent' }, reply: null },
        { id: 'comment-002', analysis: { sentiment: 'negative', decision: 'escalate', category: 'complaint', priority: 'urgent' }, reply: null },
        { id: 'comment-003', analysis: { sentiment: 'negative', decision: 'escalate', category: 'complaint', priority: 'urgent' }, reply: null },
        { id: 'comment-004', analysis: { sentiment: 'negative', decision: 'escalate', category: 'complaint', priority: 'urgent' }, reply: null },
        { id: 'dm-001',      analysis: { sentiment: 'negative', decision: 'escalate', category: 'complaint', priority: 'urgent' }, reply: null },
      ]);
      setClaudeResponse(claudeBody);

      const result = await agent.run(mockInput, mockContext);
      expect(CommunityAgent.sentimentScore(result.data!)).toBe(0.0);
    });
  });

  describe('CommunityAgent.batchInteractions()', () => {
    it('splits 25 interactions into batches of 20 and 5', () => {
      const interactions = Array.from({ length: 25 }, (_, i) => ({
        ...commentInteraction,
        id: `c-${i}`,
      }));
      const batches = CommunityAgent.batchInteractions(interactions);

      expect(batches).toHaveLength(2);
      expect(batches[0]!.length).toBe(20);
      expect(batches[1]!.length).toBe(5);
    });

    it('returns single batch when interactions ≤ batchSize', () => {
      const batches = CommunityAgent.batchInteractions(mockInput.interactions);
      expect(batches).toHaveLength(1);
    });
  });

  // ── Metadata ────────────────────────────────────────────────────────────────

  it('populates metadata fields', async () => {
    const claudeBody = makeClaudeOutput([
      { id: 'comment-001', analysis: {} },
      { id: 'comment-002', analysis: { category: 'compliment', sentiment: 'positive' } },
      { id: 'comment-003', analysis: { decision: 'escalate', category: 'complaint', sentiment: 'negative', priority: 'urgent' }, reply: null },
      { id: 'comment-004', analysis: { decision: 'ignore', category: 'spam', priority: 'low' }, reply: null },
      { id: 'dm-001',      analysis: {} },
    ]);
    setClaudeResponse(claudeBody);

    const result = await agent.run(mockInput, mockContext);

    expect(result.metadata.agentName).toBe('CommunityAgent');
    expect(result.metadata.executionId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
