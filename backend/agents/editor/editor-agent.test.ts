// ─────────────────────────────────────────────────────────────────────────────
// Postly — EditorAgent unit tests
// Run with: npx vitest backend/agents/editor
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorAgent } from './editor-agent';
import type { EditorInput, EditorOutput } from './types.js';
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

const mockInput: EditorInput = {
  image: '/9j/mockBase64==',
  imageType: 'base64',
  mimeType: 'image/jpeg',
  editingLevel: 1,
  photoContext: 'Helado de fresa recién preparado sobre mesa de madera',
};

const mockAnalysis: EditorOutput['analysis'] = {
  isSuitable: true,
  suitabilityReason: null,
  dominantColors: ['#FF6B6B', '#FFF5F5', '#FFFFFF'],
  composition: 'square',
  mainSubjects: ['helado de fresa', 'cono de barquillo', 'mesa de madera'],
  qualityScore: 8,
  qualityIssues: [],
  lightingCondition: 'natural',
  suggestedCrop: { aspectRatio: '1:1', focusPoint: { x: 0.5, y: 0.4 } },
};

const mockLevel1Response: EditorOutput = {
  analysis: mockAnalysis,
  editingParameters: {
    brightness: 5, contrast: 10, saturation: 15,
    sharpness: 20, warmth: 8, vignette: 5, filter: null,
  },
  editingNarrative: null,
  visualTags: ['helado', 'verano', 'fresa', 'artesanal', 'cono'],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EditorAgent', () => {
  let agent: EditorAgent;

  beforeEach(() => {
    agent = new EditorAgent();
    vi.clearAllMocks();
    vi.mocked(withRetry).mockImplementation((fn: () => Promise<unknown>) => fn());
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it('returns successful result for level 1 analysis', async () => {
    mockClaudeClient(vi.mocked(getClaudeClient), makeClaudeResponse(mockLevel1Response));

    const result = await agent.run(mockInput, mockContext);

    expect(result.success).toBe(true);
    expect(result.data?.analysis.isSuitable).toBe(true);
    expect(result.data?.analysis.qualityScore).toBe(8);
    expect(result.data?.editingParameters?.saturation).toBe(15);
    expect(result.data?.visualTags).toContain('fresa');
  });

  it('level 0: returns null editingParameters and editingNarrative', async () => {
    mockClaudeClient(vi.mocked(getClaudeClient), makeClaudeResponse({
      ...mockLevel1Response,
      editingParameters: null,
      editingNarrative: null,
    }));

    const result = await agent.run({ ...mockInput, editingLevel: 0 }, mockContext);

    expect(result.success).toBe(true);
    expect(result.data?.editingParameters).toBeNull();
    expect(result.data?.editingNarrative).toBeNull();
  });

  it('level 2: returns editingNarrative string', async () => {
    mockClaudeClient(vi.mocked(getClaudeClient), makeClaudeResponse({
      ...mockLevel1Response,
      editingNarrative: 'Aumentamos ligeramente la saturación para realzar los tonos rosados.',
    }));

    const result = await agent.run({ ...mockInput, editingLevel: 2 }, mockContext);

    expect(result.success).toBe(true);
    expect(typeof result.data?.editingNarrative).toBe('string');
  });

  it('handles URL-based image input and passes source.type=url to Claude', async () => {
    const mockCreate = mockClaudeClient(
      vi.mocked(getClaudeClient),
      makeClaudeResponse(mockLevel1Response),
    );

    const urlInput: EditorInput = {
      image: 'https://cdn.example.com/photos/ice-cream.jpg',
      imageType: 'url',
      mimeType: 'image/jpeg',
      editingLevel: 1,
    };

    const result = await agent.run(urlInput, mockContext);

    expect(result.success).toBe(true);
    const callBody = mockCreate.mock.calls[0][0] as {
      messages: { content: { source: { type: string } }[] }[];
    };
    expect(callBody.messages[0]!.content[0]!.source.type).toBe('url');
  });

  it('calls Claude with the correct model', async () => {
    const mockCreate = mockClaudeClient(
      vi.mocked(getClaudeClient),
      makeClaudeResponse(mockLevel1Response),
    );

    await agent.run(mockInput, mockContext);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-sonnet-4-20250514' }),
    );
  });

  // ── Metadata ────────────────────────────────────────────────────────────────

  it('populates metadata fields', async () => {
    mockClaudeClient(vi.mocked(getClaudeClient), makeClaudeResponse(mockLevel1Response));

    const result = await agent.run(mockInput, mockContext);

    expect(result.metadata.agentName).toBe('EditorAgent');
    expect(result.metadata.executionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.metadata.timestamp).toBeTruthy();
  });

  // ── Error handling ──────────────────────────────────────────────────────────

  it('returns error result when Claude returns invalid JSON', async () => {
    mockClaudeClient(vi.mocked(getClaudeClient), makeInvalidJsonResponse());

    const result = await agent.run(mockInput, mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('EXECUTION_ERROR');
    expect(result.error?.retryable).toBe(false);
  });

  it('returns error when analysis.qualityScore is missing', async () => {
    mockClaudeClient(vi.mocked(getClaudeClient), makeClaudeResponse({
      analysis: { isSuitable: true },
      editingParameters: null,
      editingNarrative: null,
      visualTags: [],
    }));

    const result = await agent.run(mockInput, mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/qualityScore/);
  });

  it('marks rate-limit errors as retryable', async () => {
    vi.mocked(withRetry).mockRejectedValue(new Error('rate_limit exceeded — please slow down'));

    const result = await agent.run(mockInput, mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.retryable).toBe(true);
    expect(result.error?.code).toBe('RATE_LIMIT');
  });

  it('strips markdown code fences from Claude response', async () => {
    mockClaudeClient(vi.mocked(getClaudeClient), makeMarkdownResponse(mockLevel1Response));

    const result = await agent.run(mockInput, mockContext);

    expect(result.success).toBe(true);
    expect(result.data?.analysis.qualityScore).toBe(8);
  });
});
