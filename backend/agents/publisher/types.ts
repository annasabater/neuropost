// ─────────────────────────────────────────────────────────────────────────────
// Postly — PublisherAgent types
// ─────────────────────────────────────────────────────────────────────────────

import type { Platform } from '../copywriter/types';

// ─── Input ────────────────────────────────────────────────────────────────────

export interface PublisherInput {
  /** Links back to the Supabase content record */
  contentPieceId: string;

  platform: Platform;

  /** Public CDN URL of the (possibly edited) image */
  imageUrl: string;

  /**
   * Final caption produced by CopywriterAgent.
   * Must NOT include hashtags yet — the agent appends them correctly per platform.
   */
  caption: string;

  /**
   * Formatted hashtag string from CopywriterAgent.formatHashtags().
   * E.g. "#HeladeriaPolar #HeladoArtesanal #Verano"
   */
  hashtags: string;

  /** Accessibility alt-text from CopywriterAgent */
  altText: string;

  /** ISO-8601 UTC — logged for auditing; timing was already handled by BullMQ */
  scheduledAt: string;

  /**
   * When true the agent skips Meta API and records a pending-approval entry.
   * Defaults to true for 'starter' tier (enforced in execute() if not provided).
   */
  requiresApproval?: boolean;
}

// ─── Brand safety ─────────────────────────────────────────────────────────────

export type SafetyRecommendation = 'publish' | 'review' | 'block';

export interface BrandSafetyCheck {
  /** Did the content pass all brand safety rules? */
  passed: boolean;
  /** 0 (critical issues) → 10 (fully on-brand) */
  score: number;
  /** List of detected issues; empty when passed */
  issues: string[];
  recommendation: SafetyRecommendation;
  /** One-line explanation for the human reviewer */
  explanation: string;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export type PublishStatus =
  | 'published'        // posted to Meta successfully
  | 'pending_approval' // awaiting human sign-off
  | 'rejected'         // blocked by brand safety check
  | 'failed';          // Meta API call failed

export interface PublisherOutput {
  status: PublishStatus;
  brandSafetyCheck: BrandSafetyCheck;

  /** Meta post/media ID — present when status === 'published' */
  metaPostId?: string;
  /** Direct link to the live post */
  metaPermalink?: string;
  /** ISO-8601 UTC timestamp of the actual publish call */
  publishedAt?: string;

  /**
   * Supabase record ID of the approval request.
   * Present when status === 'pending_approval'.
   */
  approvalRequestId?: string;

  /** Human-readable reason when status === 'rejected' or 'failed' */
  failureReason?: string;

  /** Final assembled caption that was (or would have been) sent to Meta */
  finalCaption: string;
}
