// ─────────────────────────────────────────────────────────────────────────────
// Postly — PublisherAgent unit tests
// Run with: npx vitest backend/agents/publisher
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublisherAgent, NoopApprovalStore } from './publisher-agent';
import type { ApprovalStore } from './publisher-agent';
import type { AgentContext } from '../shared/types';
import type { PublisherInput } from './types';
import {
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
  publishToInstagram: vi.fn(),
  publishToFacebook: vi.fn(),
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
import { publishToInstagram, publishToFacebook, MetaGraphError } from '../../lib/meta-graph';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const proContext: AgentContext = {
  businessId: 'biz-001',
  businessName: 'Heladería Polar',
  brandVoice: {
    tone: 'fun',
    keywords: ['artesanal', 'fresco'],
    forbiddenWords: ['barato', 'oferta'],
    sector: 'ice-cream',
    language: 'es',
    exampleCaptions: ['¡El verano sabe mejor con nosotros!'],
  },
  socialAccounts: {
    instagramId: 'ig-12345',
    facebookPageId: 'fb-67890',
    accessToken: 'mock-access-token',
  },
  timezone: 'Europe/Madrid',
  subscriptionTier: 'pro',
};

const starterContext: AgentContext = { ...proContext, subscriptionTier: 'starter' };

const mockInput: PublisherInput = {
  contentPieceId: 'piece-001',
  platform: 'instagram',
  imageUrl: 'https://cdn.postly.app/photos/piece-001.jpg',
  caption: 'Descubre nuestra fresa silvestre artesanal, recién preparada.',
  hashtags: '#HeladeriaPolar #HeladoArtesanal #Verano',
  altText: 'Cono de helado de fresa silvestre sobre mesa de madera.',
  scheduledAt: '2025-07-03T14:00:00.000Z',
  requiresApproval: false,
};

const safeSafetyCheck = {
  passed: true,
  score: 9,
  issues: [],
  recommendation: 'publish',
  explanation: 'Caption is on-brand, tone matches, no issues detected.',
};

const reviewSafetyCheck = {
  passed: false,
  score: 6,
  issues: ['Caption uses informal slang that may not suit all audiences'],
  recommendation: 'review',
  explanation: 'Minor tone mismatch — human review recommended.',
};

const blockSafetyCheck = {
  passed: false,
  score: 2,
  issues: ['Contains forbidden word "barato"', 'Misleading price claim detected'],
  recommendation: 'block',
  explanation: 'Post contains policy-violating content and must not be published.',
};

const metaPublishResult = {
  postId: 'meta-post-abc123',
  permalink: 'https://www.instagram.com/p/abc123',
  publishedAt: '2025-07-03T14:00:05.000Z',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setClaudeSafetyResponse(body: unknown) {
  mockClaudeClient(vi.mocked(getClaudeClient), makeClaudeResponse(body));
}

function setMetaPublishResult(platform: 'instagram' | 'facebook', result: unknown) {
  if (platform === 'instagram') {
    vi.mocked(publishToInstagram).mockResolvedValue(result as never);
  } else {
    vi.mocked(publishToFacebook).mockResolvedValue(result as never);
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PublisherAgent', () => {
  let agent: PublisherAgent;
  let mockApprovalStore: ApprovalStore;

  beforeEach(() => {
    mockApprovalStore = { createPendingApproval: vi.fn().mockResolvedValue(undefined) };
    agent = new PublisherAgent(mockApprovalStore);
    vi.clearAllMocks();
    vi.mocked(withRetry).mockImplementation((fn: () => Promise<unknown>) => fn());
  });

  // ── Happy path: published ───────────────────────────────────────────────────

  it('publishes to Instagram when safety check passes and no approval needed', async () => {
    setClaudeSafetyResponse(safeSafetyCheck);
    setMetaPublishResult('instagram', metaPublishResult);

    const result = await agent.run(mockInput, proContext);

    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('published');
    expect(result.data?.metaPostId).toBe('meta-post-abc123');
    expect(result.data?.metaPermalink).toBe('https://www.instagram.com/p/abc123');
  });

  it('publishes to Facebook when platform is facebook', async () => {
    setClaudeSafetyResponse(safeSafetyCheck);
    setMetaPublishResult('facebook', {
      postId: 'fb-post-xyz',
      permalink: 'https://www.facebook.com/fb-post-xyz',
      publishedAt: '2025-07-03T14:00:05.000Z',
    });

    const fbInput: PublisherInput = { ...mockInput, platform: 'facebook', requiresApproval: false };
    const result = await agent.run(fbInput, proContext);

    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('published');
  });

  it('assembles Instagram caption with hashtags separated by double newline', async () => {
    setClaudeSafetyResponse(safeSafetyCheck);
    setMetaPublishResult('instagram', metaPublishResult);

    const result = await agent.run(mockInput, proContext);

    expect(result.data?.finalCaption).toContain('\n\n#HeladeriaPolar');
  });

  it('assembles Facebook caption without appending hashtags', async () => {
    setClaudeSafetyResponse(safeSafetyCheck);
    setMetaPublishResult('facebook', { ...metaPublishResult, permalink: 'https://www.facebook.com/p/1' });

    const fbInput: PublisherInput = { ...mockInput, platform: 'facebook', requiresApproval: false };
    const result = await agent.run(fbInput, proContext);

    expect(result.data?.finalCaption).not.toContain('#HeladeriaPolar');
  });

  // ── Approval flow ───────────────────────────────────────────────────────────

  it('returns pending_approval for starter tier without calling Meta', async () => {
    setClaudeSafetyResponse(safeSafetyCheck);

    const result = await agent.run({ ...mockInput, requiresApproval: undefined }, starterContext);

    expect(vi.mocked(publishToInstagram)).not.toHaveBeenCalled();
    expect(result.data?.status).toBe('pending_approval');
    expect(result.data?.approvalRequestId).toBeTruthy();
  });

  it('forces pending_approval when requiresApproval=true regardless of tier', async () => {
    setClaudeSafetyResponse(safeSafetyCheck);

    const result = await agent.run({ ...mockInput, requiresApproval: true }, proContext);

    expect(result.data?.status).toBe('pending_approval');
  });

  it('creates an approval store record with correct fields', async () => {
    setClaudeSafetyResponse(safeSafetyCheck);

    await agent.run({ ...mockInput, requiresApproval: true }, proContext);

    expect(mockApprovalStore.createPendingApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        contentPieceId: 'piece-001',
        platform: 'instagram',
        safetyScore: 9,
      }),
    );
  });

  it('returns pending_approval when safety recommendation is "review"', async () => {
    setClaudeSafetyResponse(reviewSafetyCheck);

    const result = await agent.run({ ...mockInput, requiresApproval: false }, proContext);

    expect(result.data?.status).toBe('pending_approval');
  });

  // ── Rejection flow ──────────────────────────────────────────────────────────

  it('returns rejected when safety recommendation is "block"', async () => {
    setClaudeSafetyResponse(blockSafetyCheck);

    const result = await agent.run(mockInput, proContext);

    expect(vi.mocked(publishToInstagram)).not.toHaveBeenCalled();
    expect(result.data?.status).toBe('rejected');
    expect(result.data?.failureReason).toBeTruthy();
    expect(result.data?.brandSafetyCheck.issues.length).toBeGreaterThan(0);
  });

  // ── Meta API error handling ─────────────────────────────────────────────────

  it('returns failed status on non-retryable Meta API error', async () => {
    setClaudeSafetyResponse(safeSafetyCheck);
    vi.mocked(publishToInstagram).mockRejectedValue(
      new MetaGraphError('Invalid access token', 190, undefined, false),
    );

    const result = await agent.run(mockInput, proContext);

    expect(result.data?.status).toBe('failed');
    expect(result.data?.failureReason).toContain('190');
  });

  it('propagates retryable Meta API error so BaseAgent marks it correctly', async () => {
    setClaudeSafetyResponse(safeSafetyCheck);
    vi.mocked(publishToInstagram).mockRejectedValue(
      new MetaGraphError('Rate limited', 4, undefined, true),
    );

    const result = await agent.run(mockInput, proContext);

    expect(result.success).toBe(false);
    expect(result.error?.retryable).toBe(true);
    expect(result.error?.code).toBe('EXECUTION_ERROR');
  });

  it('returns error when instagram account ID is missing from context', async () => {
    setClaudeSafetyResponse(safeSafetyCheck);
    const ctxNoIg: AgentContext = {
      ...proContext,
      socialAccounts: { accessToken: 'tok', facebookPageId: 'fb-1' },
    };

    const result = await agent.run(mockInput, ctxNoIg);

    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/instagram/i);
  });

  // ── Safety check resilience ─────────────────────────────────────────────────

  it('returns error when safety check response is not valid JSON', async () => {
    mockClaudeClient(vi.mocked(getClaudeClient), makeInvalidJsonResponse());

    const result = await agent.run(mockInput, proContext);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('EXECUTION_ERROR');
  });

  it('marks rate-limit errors from Claude as retryable', async () => {
    vi.mocked(withRetry).mockRejectedValue(new Error('rate_limit exceeded'));

    const result = await agent.run(mockInput, proContext);

    expect(result.success).toBe(false);
    expect(result.error?.retryable).toBe(true);
  });

  it('strips markdown code fences from Claude safety-check response', async () => {
    mockClaudeClient(vi.mocked(getClaudeClient), makeMarkdownResponse(safeSafetyCheck));
    setMetaPublishResult('instagram', metaPublishResult);

    const result = await agent.run(mockInput, proContext);

    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('published');
  });

  // ── Metadata ────────────────────────────────────────────────────────────────

  it('populates metadata fields', async () => {
    setClaudeSafetyResponse(safeSafetyCheck);
    setMetaPublishResult('instagram', metaPublishResult);

    const result = await agent.run(mockInput, proContext);

    expect(result.metadata.agentName).toBe('PublisherAgent');
    expect(result.metadata.executionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0);
  });

  // ── NoopApprovalStore ────────────────────────────────────────────────────────

  it('NoopApprovalStore does not throw', async () => {
    const store = new NoopApprovalStore();
    await expect(store.createPendingApproval()).resolves.toBeUndefined();
  });
});
