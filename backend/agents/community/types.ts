// ─────────────────────────────────────────────────────────────────────────────
// Postly — CommunityAgent types
// ─────────────────────────────────────────────────────────────────────────────

import type { Platform } from '../copywriter/types';

// ─── Input ────────────────────────────────────────────────────────────────────

export type InteractionType = 'comment' | 'dm';

/**
 * A single incoming comment or DM from a follower.
 * Populated from Meta webhook payloads before calling the agent.
 */
export interface Interaction {
  /** Meta comment or message ID */
  id: string;
  type: InteractionType;
  platform: Platform;
  /** Meta user ID of the author */
  authorId: string;
  /** Display name — shown in the generated reply greeting when appropriate */
  authorName: string;
  /** Raw text of the comment or DM */
  text: string;
  /** ISO-8601 UTC */
  timestamp: string;
  /**
   * Meta post ID this comment belongs to.
   * Required for comment replies; absent for DMs.
   */
  postId?: string;
  /** Parent comment ID for nested replies */
  parentCommentId?: string;
  /** Whether this author is a verified/influential account */
  isVerified?: boolean;
}

export interface CommunityInput {
  /** Batch of interactions to process in one call (max 20 recommended) */
  interactions: Interaction[];
  /**
   * When true the agent posts replies directly to Meta Graph API.
   * When false it returns generated replies without posting them.
   */
  autoPostReplies: boolean;
}

// ─── Classification ───────────────────────────────────────────────────────────

export type InteractionCategory =
  | 'question'    // asking about product, hours, price, location
  | 'complaint'   // negative experience, problem report
  | 'compliment'  // praise, positive reaction
  | 'spam'        // promotional, irrelevant, bot-like
  | 'general'     // generic reaction (e.g. "nice!", emoji-only)
  | 'crisis';     // potentially viral negative or sensitive content

export type Sentiment = 'positive' | 'neutral' | 'negative';

export type Priority =
  | 'urgent'   // crisis, complaint with high follower author, or time-sensitive question
  | 'normal'   // standard interaction
  | 'low';     // spam, emoji-only, low-value general comments

export type ResponseDecision =
  | 'auto_respond'  // safe to reply automatically
  | 'escalate'      // needs human attention
  | 'ignore';       // spam or not worth replying

export interface InteractionAnalysis {
  category: InteractionCategory;
  sentiment: Sentiment;
  priority: Priority;
  decision: ResponseDecision;
  /** Reason shown in the dashboard when decision === 'escalate' */
  escalationReason?: string;
  /** BCP-47 code of the language detected in the interaction text */
  detectedLanguage: string;
  /** True if profanity, personal data, or sensitive topics were detected */
  containsSensitiveContent: boolean;
  /** Key topics or entities extracted from the text */
  keywords: string[];
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface InteractionResponse {
  /** Matches Interaction.id */
  interactionId: string;
  analysis: InteractionAnalysis;
  /**
   * Brand-voice reply text, ready to post.
   * Present only when analysis.decision === 'auto_respond'.
   */
  generatedReply?: string;
  /** Whether the reply was successfully posted to Meta in this run */
  replyPosted: boolean;
  /** Meta ID of the posted reply */
  metaReplyId?: string;
  /** ISO-8601 UTC timestamp of the reply post */
  postedAt?: string;
  /** Error message if posting failed (does not fail the whole batch) */
  postingError?: string;
}

export interface SentimentBreakdown {
  positive: number;
  neutral: number;
  negative: number;
}

export interface CategoryBreakdown {
  question: number;
  complaint: number;
  compliment: number;
  spam: number;
  general: number;
  crisis: number;
}

export interface CommunitySummary {
  total: number;
  autoResponded: number;
  escalated: number;
  ignored: number;
  repliesPosted: number;
  sentimentBreakdown: SentimentBreakdown;
  categoryBreakdown: CategoryBreakdown;
  /** IDs of urgent interactions requiring immediate human attention */
  urgentInteractionIds: string[];
  /** One-paragraph digest for the business owner */
  digest: string;
}

export interface CommunityOutput {
  responses: InteractionResponse[];
  summary: CommunitySummary;
}
