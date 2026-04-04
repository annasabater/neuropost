// ─────────────────────────────────────────────────────────────────────────────
// Postly — PlannerAgent unit tests
// Run with: npx vitest backend/agents/planner
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlannerAgent } from './planner-agent';
import type { PlannerInput, PlannerOutput, ScheduledPost } from './types.js';
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

const mockInput: PlannerInput = {
  month: 7,
  year: 2025,
  contentPieces: [
    {
      id: 'piece-001',
      goal: 'engagement',
      visualTags: ['helado', 'fresa'],
      platforms: ['instagram', 'facebook'],
    },
    {
      id: 'piece-002',
      goal: 'promotion',
      visualTags: ['tarrina', 'chocolate'],
      platforms: ['instagram'],
      preferredDate: '2025-07-10',
    },
    {
      id: 'piece-003',
      goal: 'community',
      visualTags: ['equipo', 'tienda'],
      platforms: ['facebook'],
    },
  ],
  postsPerWeek: 3,
  country: 'ES',
  platforms: ['instagram', 'facebook'],
  blackoutDates: ['2025-07-24'],
};

const makePost = (overrides: Partial<ScheduledPost> = {}): ScheduledPost => ({
  id: 'sched-001',
  contentPieceId: 'piece-001',
  date: '2025-07-03',
  time: '16:00',
  scheduledAt: '2025-07-03T14:00:00.000Z',
  platform: 'instagram',
  rationale: 'Thursday afternoon peak for ice-cream sector',
  isHoliday: false,
  holidayName: undefined,
  ...overrides,
});

const mockClaudeOutput: Omit<PlannerOutput, 'month' | 'year'> = {
  calendar: [
    {
      date: '2025-07-03',
      dayOfWeek: 'Thursday',
      isWeekend: false,
      isHoliday: false,
      posts: [makePost()],
    },
    {
      date: '2025-07-10',
      dayOfWeek: 'Thursday',
      isWeekend: false,
      isHoliday: false,
      posts: [makePost({ id: 'sched-002', contentPieceId: 'piece-002', date: '2025-07-10', scheduledAt: '2025-07-10T14:00:00.000Z' })],
    },
    {
      date: '2025-07-25',
      dayOfWeek: 'Friday',
      isWeekend: false,
      isHoliday: true,
      holidayName: 'Santiago Apóstol',
      posts: [],
    },
  ],
  scheduledPosts: [
    makePost(),
    makePost({ id: 'sched-002', contentPieceId: 'piece-002', date: '2025-07-10', scheduledAt: '2025-07-10T14:00:00.000Z' }),
    makePost({ id: 'sched-003', contentPieceId: 'piece-003', date: '2025-07-17', platform: 'facebook', time: '18:30', scheduledAt: '2025-07-17T16:30:00.000Z' }),
  ],
  bestTimeInsights: [
    { platform: 'instagram', bestDay: 'Thursday', bestTime: '16:00', reason: 'Afternoon peak for ice-cream sector' },
    { platform: 'facebook', bestDay: 'Friday', bestTime: '18:30', reason: 'Evening commute window' },
  ],
  unscheduledPieceIds: [],
  summary: 'July calendar optimised for summer peak. 3 posts scheduled across Instagram and Facebook, avoiding the blackout date on 24th.',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMockCreate(jsonBody: unknown) {
  return mockClaudeClient(vi.mocked(getClaudeClient), makeClaudeResponse(jsonBody));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PlannerAgent', () => {
  let agent: PlannerAgent;

  beforeEach(() => {
    agent = new PlannerAgent();
    vi.clearAllMocks();
    vi.mocked(withRetry).mockImplementation((fn: () => Promise<unknown>) => fn());
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it('returns a successful calendar result', async () => {
    getMockCreate(mockClaudeOutput);

    const result = await agent.run(mockInput, mockContext);

    expect(result.success).toBe(true);
    expect(result.data?.scheduledPosts.length).toBe(3);
    expect(result.data?.month).toBe(7);
    expect(result.data?.year).toBe(2025);
  });

  it('enriches output with month and year from input', async () => {
    getMockCreate(mockClaudeOutput);

    const result = await agent.run(mockInput, mockContext);

    expect(result.data?.month).toBe(mockInput.month);
    expect(result.data?.year).toBe(mockInput.year);
  });

  it('assigns UUIDs to posts that are missing an id', async () => {
    const outputWithoutIds = {
      ...mockClaudeOutput,
      scheduledPosts: mockClaudeOutput.scheduledPosts.map(({ id: _id, ...rest }) => rest),
    };
    getMockCreate(outputWithoutIds);

    const result = await agent.run(mockInput, mockContext);

    for (const post of result.data!.scheduledPosts) {
      expect(post.id).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it('sorts scheduledPosts by scheduledAt ascending', async () => {
    // Shuffle the order to test sort
    const shuffled = {
      ...mockClaudeOutput,
      scheduledPosts: [...mockClaudeOutput.scheduledPosts].reverse(),
    };
    getMockCreate(shuffled);

    const result = await agent.run(mockInput, mockContext);
    const posts = result.data!.scheduledPosts;

    for (let i = 1; i < posts.length; i++) {
      expect(new Date(posts[i]!.scheduledAt).getTime()).toBeGreaterThanOrEqual(
        new Date(posts[i - 1]!.scheduledAt).getTime(),
      );
    }
  });

  it('detects and surfaces holidays from Claude response', async () => {
    getMockCreate(mockClaudeOutput);

    const result = await agent.run(mockInput, mockContext);
    const holidays = result.data!.calendar.filter((d) => d.isHoliday);

    expect(holidays.length).toBeGreaterThan(0);
    expect(holidays[0]!.holidayName).toBeTruthy();
  });

  it('returns bestTimeInsights for each platform', async () => {
    getMockCreate(mockClaudeOutput);

    const result = await agent.run(mockInput, mockContext);
    const platforms = result.data!.bestTimeInsights.map((i) => i.platform);

    expect(platforms).toContain('instagram');
    expect(platforms).toContain('facebook');
  });

  it('includes metadata fields', async () => {
    getMockCreate(mockClaudeOutput);

    const result = await agent.run(mockInput, mockContext);

    expect(result.metadata.agentName).toBe('PlannerAgent');
    expect(result.metadata.executionId).toMatch(/^[0-9a-f-]{36}$/);
  });

  // ── Input validation ────────────────────────────────────────────────────────

  it('returns error for invalid month', async () => {
    const result = await agent.run({ ...mockInput, month: 13 }, mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/month/);
  });

  it('returns error for empty contentPieces', async () => {
    const result = await agent.run({ ...mockInput, contentPieces: [] }, mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/contentPieces/);
  });

  it('returns error for unrealistic postsPerWeek', async () => {
    const result = await agent.run({ ...mockInput, postsPerWeek: 99 }, mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/postsPerWeek/);
  });

  // ── Error handling ──────────────────────────────────────────────────────────

  it('returns error on invalid JSON from Claude', async () => {
    mockClaudeClient(vi.mocked(getClaudeClient), makeInvalidJsonResponse());

    const result = await agent.run(mockInput, mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('EXECUTION_ERROR');
  });

  it('returns error when scheduledPosts is missing', async () => {
    const { scheduledPosts: _sp, ...withoutPosts } = mockClaudeOutput;
    getMockCreate(withoutPosts);

    const result = await agent.run(mockInput, mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/scheduledPosts/);
  });

  it('marks rate-limit errors as retryable', async () => {
    vi.mocked(withRetry).mockRejectedValue(new Error('rate_limit exceeded'));

    const result = await agent.run(mockInput, mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.retryable).toBe(true);
  });

  it('strips markdown code fences from response', async () => {
    mockClaudeClient(vi.mocked(getClaudeClient), makeMarkdownResponse(mockClaudeOutput));

    const result = await agent.run(mockInput, mockContext);

    expect(result.success).toBe(true);
  });

  // ── Static helpers ──────────────────────────────────────────────────────────

  describe('PlannerAgent.postsForDate()', () => {
    it('returns only posts for the given date', async () => {
      getMockCreate(mockClaudeOutput);
      const result = await agent.run(mockInput, mockContext);

      const posts = PlannerAgent.postsForDate(result.data!, '2025-07-03');

      expect(posts.every((p) => p.date === '2025-07-03')).toBe(true);
    });

    it('returns empty array for a date with no posts', async () => {
      getMockCreate(mockClaudeOutput);
      const result = await agent.run(mockInput, mockContext);

      expect(PlannerAgent.postsForDate(result.data!, '2025-07-01')).toHaveLength(0);
    });
  });

  describe('PlannerAgent.upcomingPosts()', () => {
    it('returns posts within the lookahead window', async () => {
      getMockCreate(mockClaudeOutput);
      const result = await agent.run(mockInput, mockContext);

      // Reference time 1 hour before the first post
      const ref = new Date('2025-07-03T13:00:00.000Z');
      const upcoming = PlannerAgent.upcomingPosts(result.data!, ref, 4);

      expect(upcoming.length).toBeGreaterThan(0);
      expect(upcoming.every((p) => new Date(p.scheduledAt) >= ref)).toBe(true);
    });
  });

  describe('PlannerAgent.isFullyCovered()', () => {
    it('returns true when all pieces are scheduled', async () => {
      getMockCreate(mockClaudeOutput);
      const result = await agent.run(mockInput, mockContext);

      expect(PlannerAgent.isFullyCovered(result.data!)).toBe(true);
    });

    it('returns false when some pieces are unscheduled', async () => {
      getMockCreate({ ...mockClaudeOutput, unscheduledPieceIds: ['piece-003'] });
      const result = await agent.run(mockInput, mockContext);

      expect(PlannerAgent.isFullyCovered(result.data!)).toBe(false);
    });
  });
});
