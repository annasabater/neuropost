// ─────────────────────────────────────────────────────────────────────────────
// Postly — CommunityAgent prompts
// One batch call processes all interactions: classify + generate reply.
// ─────────────────────────────────────────────────────────────────────────────

import type { AgentContext } from '../shared/types.js';
import type { CommunityInput, Interaction } from './types.js';

// ─── System prompt ────────────────────────────────────────────────────────────

/**
 * Establishes Claude as a community manager fluent in the brand voice,
 * with clear decision rules for when to auto-respond vs. escalate.
 */
export function buildCommunitySystemPrompt(context: AgentContext): string {
  const { businessName, brandVoice } = context;

  return `You are the community manager for ${businessName}, a ${brandVoice.sector} business.

## Your responsibilities
Analyse incoming comments and DMs, classify each one, decide whether to respond automatically or escalate to a human, and write replies for those you will auto-respond to.

## Brand voice
- Tone: ${brandVoice.tone}
- Language: ${brandVoice.language} — reply in the same language as the interaction when possible; default to ${brandVoice.language}
- Keywords to use naturally: ${brandVoice.keywords.join(', ')}
- Words NEVER to use: ${brandVoice.forbiddenWords.join(', ')}

## Reply guidelines
- Keep replies concise: 1–3 sentences maximum.
- Be warm and personal — use the author's name when it feels natural.
- Never invent facts about products, prices, or opening hours.
- Do not copy-paste the same reply to multiple interactions; vary phrasing.
- Never reply to spam — mark it 'ignore'.

## Decision rules (apply in order)
| Condition                                          | decision        | priority |
|----------------------------------------------------|-----------------|----------|
| Spam or bot-like content                           | ignore          | low      |
| Crisis (threats, viral complaint, legal risk)      | escalate        | urgent   |
| Complaint with expressed negative emotion          | escalate        | urgent   |
| Sensitive personal data in message                 | escalate        | normal   |
| DM asking for pricing or product availability      | auto_respond    | normal   |
| Simple question (hours, address, etc.)             | auto_respond    | normal   |
| Compliment or positive reaction                    | auto_respond    | normal   |
| Emoji-only or one-word reaction                    | auto_respond    | low      |
| General comment                                    | auto_respond    | normal   |

Return ONLY valid JSON. No markdown, no text outside the JSON.`;
}

// ─── User prompt ──────────────────────────────────────────────────────────────

const ANALYSIS_SCHEMA = `{
  "category": "question" | "complaint" | "compliment" | "spam" | "general" | "crisis",
  "sentiment": "positive" | "neutral" | "negative",
  "priority": "urgent" | "normal" | "low",
  "decision": "auto_respond" | "escalate" | "ignore",
  "escalationReason": string | null,
  "detectedLanguage": string,
  "containsSensitiveContent": boolean,
  "keywords": string[]
}`;

/**
 * Formats the interaction list as a numbered block for the prompt.
 */
function formatInteractions(interactions: Interaction[]): string {
  return interactions
    .map(
      (it, i) =>
        `[${i + 1}] id: "${it.id}"
  type: ${it.type} | platform: ${it.platform}
  author: "${it.authorName}"${it.isVerified ? ' (verified)' : ''}
  text: "${it.text}"
  timestamp: ${it.timestamp}`,
    )
    .join('\n\n');
}

/**
 * Builds the batch user prompt for a set of interactions.
 *
 * @param input   CommunityInput with the interactions to process
 * @param context AgentContext — used to surface business name in prompt
 */
export function buildCommunityUserPrompt(
  input: CommunityInput,
  context: AgentContext,
): string {
  const interactionBlock = formatInteractions(input.interactions);

  return `Process these ${input.interactions.length} interaction(s) for ${context.businessName}.

${interactionBlock}

For each interaction return a JSON object in the "responses" array with this structure:
{
  "interactionId": string,           // must match the id in the input
  "analysis": ${ANALYSIS_SCHEMA},
  "generatedReply": string | null    // non-null ONLY when decision === "auto_respond"
}

Then return a "digest" string: a 2–3 sentence summary of the batch for the business owner.

Return this exact top-level JSON:
{
  "responses": [...],
  "digest": string
}`;
}
