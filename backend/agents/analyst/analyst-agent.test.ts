// ─────────────────────────────────────────────────────────────────────────────
// Postly — AnalystAgent unit tests
// Run with: npx vitest backend/agents/analyst
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalystAgent } from './analyst-agent.js';
import type { AnalystInput, AnalystOutput, PostMetrics } from './types.js';
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

// Hoisted references to mocked exports — avoids repeated dynamic imports
import { getClaudeClient, withRetry } from '../shared/claude-client';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const makePost = (
  id: string,
  platform: 'instagram' | 'facebook',
  engagementRate: number,
  reach = 1000,
): PostMetrics => ({
  postId: id,
  contentPieceId: `piece-${id}`,
  platform,
  publishedAt: '2025-07-10T14:00:00.000Z',
  reach,
  impressions: reach * 1.3,
  likes: Math.round(reach * engagementRate * 0.6 / 100),
  comments: Math.round(reach * engagementRate * 0.2 / 100),
  shares: Math.round(reach * engagementRate * 0.1 / 100),
  saves: Math.round(reach * engagementRate * 0.1 / 100),
  engagementRate,
  captionPreview: `Caption for post ${id}`,
  visualTags: ['helado', 'verano'],
});

const mockInput: AnalystInput = {
  period: { month: 7, year: 2025 },
  postMetrics: [
    makePost('post-001', 'instagram', 5.2, 1800),
    makePost('post-002', 'instagram', 3.8, 1200),
    makePost('post-003', 'instagram', 1.1, 800),
    makePost('post-004', 'facebook',  2.9, 950),
    makePost('post-005', 'facebook',  1.8, 600),
  ],
  accountMetrics: [
    {
      platform: 'instagram',
      followersStart: 2400,
      followersEnd: 2520,
      followersGained: 120,
      profileVisits: 850,
      websiteClicks: 63,
      totalReach: 3800,
      totalImpressions: 5200,
    },
    {
      platform: 'facebook',
      followersStart: 1100,
      followersEnd: 1130,
      followersGained: 30,
      profileVisits: 310,
      websiteClicks: 22,
      totalReach: 1550,
      totalImpressions: 2000,
    },
  ],
  communityMetrics: {
    totalInteractions: 48,
    autoResponded: 35,
    escalated: 3,
    sentimentScore: 0.78,
    sentimentBreakdown: { positive: 28, neutral: 14, negative: 6 },
  },
  plannerMetrics: {
    plannedPosts: 8,
    publishedPosts: 5,
    pendingApproval: 2,
    rejected: 1,
    completionRate: 62.5,
  },
  previousPeriod: {
    avgEngagementRate: 2.8,
    totalReach: 4200,
    followersGained: 95,
    sentimentScore: 0.72,
    publishedPosts: 6,
  },
};

const mockClaudeOutput: Omit<AnalystOutput, 'period' | 'generatedAt'> = {
  scores: { overall: 7, content: 8, community: 7, growth: 6, execution: 6 },
  topPosts: [
    { postId: 'post-001', contentPieceId: 'piece-post-001', platform: 'instagram', engagementRate: 5.2, reach: 1800, performanceFactor: 'Strong visual composition and question hook drove high comment volume.' },
    { postId: 'post-002', contentPieceId: 'piece-post-002', platform: 'instagram', engagementRate: 3.8, reach: 1200, performanceFactor: 'Afternoon Thursday slot aligned with peak ice-cream browsing window.' },
    { postId: 'post-004', contentPieceId: 'piece-post-004', platform: 'facebook',  engagementRate: 2.9, reach: 950,  performanceFactor: 'Seasonal content resonated well with local Facebook audience.' },
  ],
  lowPosts: [
    { postId: 'post-003', contentPieceId: 'piece-post-003', platform: 'instagram', engagementRate: 1.1, reach: 800, performanceFactor: 'Low engagement likely due to posting on a Monday — historically weak for this sector.' },
  ],
  insights: [
    { type: 'strength',     title: 'Top Instagram post beat sector benchmark',       description: 'Post-001 achieved 5.2% engagement vs 3.0–5.5% benchmark.', supportingMetric: '5.2% vs 3.0–5.5% sector range' },
    { type: 'weakness',     title: 'Execution rate below target',                    description: 'Only 62.5% of planned posts were published.',              supportingMetric: '5/8 posts published' },
    { type: 'opportunity',  title: 'Facebook audience has room to grow',             description: 'Facebook reach is 59% lower than Instagram.',              supportingMetric: 'IG 3,800 vs FB 1,550 reach' },
    { type: 'strength',     title: 'Community sentiment trending positive',          description: 'Sentiment score improved from 72% to 78% month-over-month.', supportingMetric: '+8.3% MoM improvement' },
  ],
  recommendations: [
    { priority: 'high',   action: 'Publish on Thursdays and Saturdays in the 15:00–17:00 window', rationale: 'Top post and benchmark data both confirm afternoon slots outperform morning ones.', estimatedImpact: '+20% average engagement' },
    { priority: 'high',   action: 'Clear the 2 posts currently pending approval before 15th August', rationale: 'Pending posts reduce monthly reach potential by approximately 30%.', estimatedImpact: '+30% total reach' },
    { priority: 'medium', action: 'Create 2 Facebook-specific posts next month', rationale: 'Facebook audience is underserved; cross-posting IG content performs 40% worse.', estimatedImpact: '+15% Facebook engagement' },
  ],
  platformBreakdowns: [
    { platform: 'instagram', postCount: 3, avgEngagementRate: 3.4, totalReach: 3800, followersGained: 120 },
    { platform: 'facebook',  postCount: 2, avgEngagementRate: 2.4, totalReach: 1550, followersGained: 30 },
  ],
  report: `# July 2025 Social Media Report — Heladería Polar\n\n## How did we do this month?\n\nPuntuación general: **7/10**. Julio fue un mes sólido...`,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setClaudeResponse(body: unknown) {
  mockClaudeClient(vi.mocked(getClaudeClient), makeClaudeResponse(body));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AnalystAgent', () => {
  let agent: AnalystAgent;

  beforeEach(() => {
    agent = new AnalystAgent();
    vi.clearAllMocks();
    vi.mocked(withRetry).mockImplementation((fn: () => Promise<unknown>) => fn());
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it('returns a successful analysis result', async () => {
    setClaudeResponse(mockClaudeOutput);

    const result = await agent.run(mockInput, mockContext);

    expect(result.success).toBe(true);
    expect(result.data?.scores.overall).toBe(7);
    expect(result.data?.topPosts).toHaveLength(3);
    expect(result.data?.lowPosts).toHaveLength(1);
    expect(result.data?.insights.length).toBeGreaterThanOrEqual(4);
    expect(result.data?.recommendations.length).toBeGreaterThanOrEqual(3);
  });

  it('stamps period and generatedAt from input / runtime', async () => {
    setClaudeResponse(mockClaudeOutput);

    const result = await agent.run(mockInput, mockContext);

    expect(result.data?.period).toEqual({ month: 7, year: 2025 });
    expect(result.data?.generatedAt).toBeTruthy();
    expect(() => new Date(result.data!.generatedAt)).not.toThrow();
  });

  it('clamps out-of-range scores to 0–10', async () => {
    setClaudeResponse({
      ...mockClaudeOutput,
      scores: { overall: 15, content: -2, community: 7, growth: 6, execution: 6 },
    });

    const result = await agent.run(mockInput, mockContext);

    expect(result.data?.scores.overall).toBe(10);
    expect(result.data?.scores.content).toBe(0);
  });

  it('caps topPosts at 3 and lowPosts at 2', async () => {
    const manyPosts = Array.from({ length: 5 }, (_, i) => ({
      ...mockClaudeOutput.topPosts[0]!,
      postId: `extra-${i}`,
    }));
    setClaudeResponse({ ...mockClaudeOutput, topPosts: manyPosts, lowPosts: manyPosts });

    const result = await agent.run(mockInput, mockContext);

    expect(result.data?.topPosts.length).toBeLessThanOrEqual(3);
    expect(result.data?.lowPosts.length).toBeLessThanOrEqual(2);
  });

  it('computes platform breakdowns from input when Claude omits them', async () => {
    const { platformBreakdowns: _pb, ...withoutBreakdowns } = mockClaudeOutput;
    setClaudeResponse({ ...withoutBreakdowns, platformBreakdowns: [] });

    const result = await agent.run(mockInput, mockContext);
    const platforms = result.data!.platformBreakdowns.map((b) => b.platform);

    expect(platforms).toContain('instagram');
    expect(platforms).toContain('facebook');
  });

  it('report is a non-empty string', async () => {
    setClaudeResponse(mockClaudeOutput);

    const result = await agent.run(mockInput, mockContext);

    expect(typeof result.data?.report).toBe('string');
    expect(result.data!.report.length).toBeGreaterThan(50);
  });

  it('strips markdown code fences from Claude response', async () => {
    mockClaudeClient(vi.mocked(getClaudeClient), makeMarkdownResponse(mockClaudeOutput));

    const result = await agent.run(mockInput, mockContext);

    expect(result.success).toBe(true);
  });

  // ── Input validation ────────────────────────────────────────────────────────

  it('returns error for invalid month', async () => {
    const result = await agent.run({ ...mockInput, period: { month: 0, year: 2025 } }, mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/month/);
  });

  it('returns error when postMetrics is empty', async () => {
    const result = await agent.run({ ...mockInput, postMetrics: [] }, mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/postMetrics/);
  });

  it('returns error when accountMetrics is empty', async () => {
    const result = await agent.run({ ...mockInput, accountMetrics: [] }, mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/accountMetrics/);
  });

  // ── Error handling ──────────────────────────────────────────────────────────

  it('returns error on invalid JSON from Claude', async () => {
    mockClaudeClient(vi.mocked(getClaudeClient), makeInvalidJsonResponse());

    const result = await agent.run(mockInput, mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('EXECUTION_ERROR');
  });

  it('returns error when scores field is missing', async () => {
    const { scores: _s, ...withoutScores } = mockClaudeOutput;
    setClaudeResponse(withoutScores);

    const result = await agent.run(mockInput, mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/scores/);
  });

  it('returns error when report string is empty', async () => {
    setClaudeResponse({ ...mockClaudeOutput, report: '' });

    const result = await agent.run(mockInput, mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/report/);
  });

  it('marks rate-limit errors as retryable', async () => {
    vi.mocked(withRetry).mockRejectedValue(new Error('rate_limit exceeded'));

    const result = await agent.run(mockInput, mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.retryable).toBe(true);
  });

  // ── Metadata ────────────────────────────────────────────────────────────────

  it('populates metadata fields', async () => {
    setClaudeResponse(mockClaudeOutput);

    const result = await agent.run(mockInput, mockContext);

    expect(result.metadata.agentName).toBe('AnalystAgent');
    expect(result.metadata.executionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0);
  });

  // ── Static helpers ──────────────────────────────────────────────────────────

  describe('AnalystAgent.underperformers()', () => {
    it('returns posts below 70% of the average engagement rate', () => {
      const posts = mockInput.postMetrics;
      // avg ≈ (5.2 + 3.8 + 1.1 + 2.9 + 1.8) / 5 = 2.96; 70% = 2.07
      // posts below: 1.1, 1.8
      const under = AnalystAgent.underperformers(posts);

      expect(under.every((p) => p.engagementRate < 2.96 * 0.7)).toBe(true);
      expect(under.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty array for empty input', () => {
      expect(AnalystAgent.underperformers([])).toEqual([]);
    });
  });

  describe('AnalystAgent.delta()', () => {
    it('computes positive delta correctly', () => {
      expect(AnalystAgent.delta(4.2, 3.8)).toBeCloseTo(10.5, 0);
    });

    it('computes negative delta correctly', () => {
      expect(AnalystAgent.delta(2.5, 3.0)).toBeCloseTo(-16.7, 0);
    });

    it('returns 0 when previous is 0', () => {
      expect(AnalystAgent.delta(5, 0)).toBe(0);
    });
  });

  describe('AnalystAgent.toSnapshot()', () => {
    it('derives a valid snapshot from output + input', async () => {
      setClaudeResponse(mockClaudeOutput);

      const result = await agent.run(mockInput, mockContext);
      const snapshot = AnalystAgent.toSnapshot(result.data!, mockInput);

      expect(snapshot.publishedPosts).toBe(mockInput.plannerMetrics.publishedPosts);
      expect(snapshot.sentimentScore).toBe(mockInput.communityMetrics.sentimentScore);
      expect(typeof snapshot.avgEngagementRate).toBe('number');
      expect(snapshot.totalReach).toBeGreaterThan(0);
      expect(snapshot.followersGained).toBe(150); // 120 IG + 30 FB
    });
  });
});
