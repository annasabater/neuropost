// ─────────────────────────────────────────────────────────────────────────────
// NeuroPost — SupportAgent
//
// Dedicated support agent for client tickets and chat messages.
// Unlike CommunityAgent (built for IG comment moderation, which can decide
// `ignore`/`escalate` and return null), this agent ALWAYS returns a reply.
//
// Input:  one client message + optional thread history + ticket metadata
// Output: { reply, category, solutions, needsHumanFollowUp, resolved, ... }
// ─────────────────────────────────────────────────────────────────────────────

import type Anthropic from '@anthropic-ai/sdk';
import { BaseAgent } from '../shared/base-agent';
import { getClaudeClient, CLAUDE_MODEL, withRetry } from '../shared/claude-client';
import type { AgentContext } from '../shared/types';
import type { SupportInput, SupportOutput, SupportCategory } from './types';
import { buildSupportSystemPrompt, buildSupportUserPrompt } from './prompts';

const MAX_CLIENT_MESSAGE_LEN = 4000;

const FALLBACK_REPLY = `Hola, he recibido tu mensaje pero no he podido generar una respuesta automática. Un miembro del equipo lo revisará y te responderá lo antes posible. Si es urgente, puedes escribirnos a través del chat y priorizaremos tu caso.`;

const VALID_CATEGORIES: SupportCategory[] = [
  'billing', 'technical', 'account', 'connection', 'feature_request', 'howto', 'content', 'other',
];

export class SupportAgent extends BaseAgent<SupportInput, SupportOutput> {
  constructor() {
    super('SupportAgent');
  }

  protected async execute(
    input: SupportInput,
    context: AgentContext,
    executionId: string,
  ): Promise<SupportOutput> {
    this.validateInput(input);

    this.log('info', 'Support ticket resolution started', {
      executionId,
      source: input.source,
      priority: input.priority,
      historyLength: input.messageHistory?.length ?? 0,
    });

    const response = await withRetry(() =>
      getClaudeClient().messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1500,
        system: buildSupportSystemPrompt(context),
        messages: [
          { role: 'user', content: buildSupportUserPrompt(input, context) },
        ],
      }),
    );

    const parsed = this.parseResponse(response, executionId);

    // Final safety net: if somehow the reply came back empty despite the
    // prompt instructions, substitute a human-escalation fallback.
    if (!parsed.reply || !parsed.reply.trim()) {
      this.log('warn', 'Support agent returned empty reply — using fallback', { executionId });
      parsed.reply = FALLBACK_REPLY;
      parsed.needsHumanFollowUp = true;
      parsed.resolved = false;
      parsed.escalationReason = 'Empty reply from model — manual follow-up required';
    }

    this.log('info', 'Support ticket resolved', {
      executionId,
      category: parsed.category,
      resolved: parsed.resolved,
      needsHumanFollowUp: parsed.needsHumanFollowUp,
    });

    return parsed;
  }

  // ─── Private: parse Claude response ────────────────────────────────────────

  private parseResponse(response: Anthropic.Message, executionId: string): SupportOutput {
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('SupportAgent: Claude returned no text block');
    }

    const cleaned = textBlock.text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      this.log('error', 'Support JSON parse failed', {
        executionId,
        raw: textBlock.text.slice(0, 400),
      });
      // Graceful degradation: return a fallback reply rather than throwing.
      return {
        reply: FALLBACK_REPLY,
        category: 'other',
        sentiment: 'neutral',
        language: 'es',
        solutions: [],
        needsHumanFollowUp: true,
        escalationReason: 'Agent response was not valid JSON',
        resolved: false,
      };
    }

    return this.normalize(parsed);
  }

  /**
   * Coerces the parsed JSON into a well-formed SupportOutput,
   * defaulting missing fields so the caller never crashes.
   */
  private normalize(raw: unknown): SupportOutput {
    if (!raw || typeof raw !== 'object') {
      return {
        reply: FALLBACK_REPLY,
        category: 'other',
        sentiment: 'neutral',
        language: 'es',
        solutions: [],
        needsHumanFollowUp: true,
        escalationReason: 'Agent returned non-object response',
        resolved: false,
      };
    }

    const obj = raw as Record<string, unknown>;

    const category = (typeof obj.category === 'string' && VALID_CATEGORIES.includes(obj.category as SupportCategory))
      ? obj.category as SupportCategory
      : 'other';

    const sentiment = (obj.sentiment === 'frustrated' || obj.sentiment === 'happy')
      ? obj.sentiment
      : 'neutral';

    const solutionsRaw = Array.isArray(obj.solutions) ? obj.solutions : [];
    const solutions = solutionsRaw
      .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
      .map((s) => ({
        title: typeof s.title === 'string' ? s.title : '',
        steps: Array.isArray(s.steps) ? s.steps.filter((x): x is string => typeof x === 'string') : [],
        link: typeof s.link === 'string' ? s.link : undefined,
      }))
      .filter((s) => s.title.length > 0);

    return {
      reply: typeof obj.reply === 'string' ? obj.reply : '',
      category,
      sentiment,
      language: typeof obj.language === 'string' ? obj.language : 'es',
      solutions,
      needsHumanFollowUp: obj.needsHumanFollowUp === true,
      escalationReason: typeof obj.escalationReason === 'string' ? obj.escalationReason : undefined,
      resolved: obj.resolved === true,
    };
  }

  // ─── Input validation ──────────────────────────────────────────────────────

  private validateInput(input: SupportInput): void {
    if (!input.clientMessage || !input.clientMessage.trim()) {
      throw new Error('SupportAgent: clientMessage is required');
    }
    if (input.clientMessage.length > MAX_CLIENT_MESSAGE_LEN) {
      throw new Error(
        `SupportAgent: clientMessage length ${input.clientMessage.length} exceeds ${MAX_CLIENT_MESSAGE_LEN} chars`,
      );
    }
    if (input.source !== 'ticket' && input.source !== 'chat') {
      throw new Error(`SupportAgent: invalid source '${input.source}' (must be 'ticket' or 'chat')`);
    }
  }
}
