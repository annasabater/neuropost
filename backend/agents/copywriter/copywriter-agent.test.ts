// ─────────────────────────────────────────────────────────────────────────────
// Postly — CopywriterAgent unit tests
// Run with: npx vitest backend/agents/copywriter
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CopywriterAgent } from './copywriter-agent';
import type { CopywriterInput, CopywriterOutput } from './types.js';
import type { ImageAnalysis } from '../editor/types.js';
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

const mockAnalysis: ImageAnalysis = {
  isSuitable: true,
  suitabilityReason: null,
  dominantColors: ['#FF6B6B', '#FFF5F5'],
  composition: 'square',
  mainSubjects: ['helado de fresa', 'cono de barquillo'],
  qualityScore: 8,
  qualityIssues: [],
  lightingCondition: 'natural',
  suggestedCrop: null,
};

const mockInput: CopywriterInput = {
  visualTags: ['helado', 'fresa', 'verano', 'artesanal', 'cono'],
  imageAnalysis: mockAnalysis,
  goal: 'engagement',
  platforms: ['instagram', 'facebook'],
  postContext: 'Nuevo sabor de temporada: fresa silvestre',
};

const mockOutput: CopywriterOutput = {
  copies: {
    instagram: {
      caption:
        '¿Cuál es tu sabor de verano favorito? Este mes presentamos nuestra fresa silvestre artesanal, recogida en temporada y sin colorantes. Pásate y pruébala 🍓',
      charCount: 163,
    },
    facebook: {
      caption: 'Nueva fresa silvestre artesanal, solo esta temporada. ¡Ven a probarla!',
      charCount: 70,
    },
  },
  hashtags: {
    branded: ['#HeladeriaPolar', '#PolarHelados'],
    niche: ['#HeladoArtesanal', '#FresaSilvestre', '#HeladoNatural', '#HeladoEspañol'],
    broad: ['#Verano', '#Helado', '#IceCream'],
  },
  callToAction: 'Visítanos esta semana y prueba la fresa silvestre',
  altText: 'Cono de helado de fresa silvestre artesanal sobre mesa de madera clara.',
  strategySummary:
    'Conversational engagement approach on Instagram with a question hook; punchy awareness copy on Facebook highlighting seasonal exclusivity.',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMockCreate(jsonBody: unknown) {
  return mockClaudeClient(vi.mocked(getClaudeClient), makeClaudeResponse(jsonBody));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CopywriterAgent', () => {
  let agent: CopywriterAgent;

  beforeEach(() => {
    agent = new CopywriterAgent();
    vi.clearAllMocks();
    vi.mocked(withRetry).mockImplementation((fn: () => Promise<unknown>) => fn());
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it('returns copy for both platforms', async () => {
    getMockCreate(mockOutput);

    const result = await agent.run(mockInput, mockContext);

    expect(result.success).toBe(true);
    expect(result.data?.copies.instagram?.caption).toBeTruthy();
    expect(result.data?.copies.facebook?.caption).toBeTruthy();
  });

  it('computes charCount from caption length', async () => {
    getMockCreate(mockOutput);

    const result = await agent.run(mockInput, mockContext);

    const ig = result.data?.copies.instagram!;
    expect(ig.charCount).toBe(ig.caption.length);
  });

  it('returns tiered hashtags', async () => {
    getMockCreate(mockOutput);

    const result = await agent.run(mockInput, mockContext);
    const ht = result.data?.hashtags!;

    expect(ht.branded.length).toBeGreaterThan(0);
    expect(ht.niche.length).toBeGreaterThan(0);
    expect(ht.broad.length).toBeGreaterThan(0);
  });

  it('returns callToAction, altText and strategySummary', async () => {
    getMockCreate(mockOutput);

    const result = await agent.run(mockInput, mockContext);

    expect(typeof result.data?.callToAction).toBe('string');
    expect(typeof result.data?.altText).toBe('string');
    expect(typeof result.data?.strategySummary).toBe('string');
  });

  it('generates only instagram copy when only instagram requested', async () => {
    const igOnlyOutput: CopywriterOutput = {
      ...mockOutput,
      copies: { instagram: mockOutput.copies.instagram },
    };
    getMockCreate(igOnlyOutput);

    const result = await agent.run({ ...mockInput, platforms: ['instagram'] }, mockContext);

    expect(result.success).toBe(true);
    expect(result.data?.copies.instagram).toBeTruthy();
    expect(result.data?.copies.facebook).toBeUndefined();
  });

  it('strips markdown code fences from Claude response', async () => {
    mockClaudeClient(vi.mocked(getClaudeClient), makeMarkdownResponse(mockOutput));

    const result = await agent.run(mockInput, mockContext);

    expect(result.success).toBe(true);
  });

  it('includes product info in prompt when provided', async () => {
    const mockCreate = getMockCreate(mockOutput);
    const inputWithProduct: CopywriterInput = {
      ...mockInput,
      product: { name: 'Tarrina XL', price: '4,50 €', description: 'Perfecta para compartir' },
    };

    await agent.run(inputWithProduct, mockContext);

    const prompt = mockCreate.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain('Tarrina XL');
    expect(prompt).toContain('4,50 €');
  });

  // ── Metadata ────────────────────────────────────────────────────────────────

  it('populates metadata fields', async () => {
    getMockCreate(mockOutput);

    const result = await agent.run(mockInput, mockContext);

    expect(result.metadata.agentName).toBe('CopywriterAgent');
    expect(result.metadata.executionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  // ── Error handling ──────────────────────────────────────────────────────────

  it('returns error on invalid JSON from Claude', async () => {
    mockClaudeClient(vi.mocked(getClaudeClient), makeInvalidJsonResponse());

    const result = await agent.run(mockInput, mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('EXECUTION_ERROR');
  });

  it('returns error when a requested platform copy is missing', async () => {
    const missingFacebook = { ...mockOutput, copies: { instagram: mockOutput.copies.instagram } };
    getMockCreate(missingFacebook);

    // We requested both platforms but Claude only returned instagram
    const result = await agent.run(mockInput, mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/facebook/i);
  });

  it('marks rate-limit errors as retryable', async () => {
    vi.mocked(withRetry).mockRejectedValue(new Error('rate_limit exceeded'));

    const result = await agent.run(mockInput, mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.retryable).toBe(true);
    expect(result.error?.code).toBe('RATE_LIMIT');
  });

  // ── Static helpers ──────────────────────────────────────────────────────────

  describe('CopywriterAgent.fromEditorOutput()', () => {
    it('maps EditorOutput fields correctly', () => {
      const input = CopywriterAgent.fromEditorOutput(
        { visualTags: mockInput.visualTags, analysis: mockAnalysis },
        'engagement',
        ['instagram'],
        { postContext: 'Nueva temporada' },
      );

      expect(input.visualTags).toEqual(mockInput.visualTags);
      expect(input.imageAnalysis).toBe(mockAnalysis);
      expect(input.goal).toBe('engagement');
      expect(input.platforms).toEqual(['instagram']);
      expect(input.postContext).toBe('Nueva temporada');
    });
  });

  describe('CopywriterAgent.formatHashtags()', () => {
    it('returns ≤ 15 tags for instagram with # prefix', () => {
      const result = CopywriterAgent.formatHashtags(mockOutput.hashtags, 'instagram');
      const tags = result.split(' ');

      expect(tags.length).toBeLessThanOrEqual(15);
      expect(tags.every((t) => t.startsWith('#'))).toBe(true);
    });

    it('returns ≤ 5 tags for facebook (branded + niche only)', () => {
      const result = CopywriterAgent.formatHashtags(mockOutput.hashtags, 'facebook');
      const tags = result.split(' ');

      expect(tags.length).toBeLessThanOrEqual(5);
    });

    it('does not duplicate # prefix when tags already have it', () => {
      const result = CopywriterAgent.formatHashtags(mockOutput.hashtags, 'instagram');
      expect(result).not.toContain('##');
    });
  });
});
