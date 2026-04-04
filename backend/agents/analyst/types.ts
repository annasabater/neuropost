// ─────────────────────────────────────────────────────────────────────────────
// Postly — AnalystAgent types
// ─────────────────────────────────────────────────────────────────────────────

import type { Platform } from '../copywriter/types.js';
import type { SentimentBreakdown } from '../community/types.js';

// ─── Input ────────────────────────────────────────────────────────────────────

/** Metrics for a single published post — sourced from Meta Graph API */
export interface PostMetrics {
  /** Meta post / media ID */
  postId: string;
  /** Links back to the Supabase content record */
  contentPieceId: string;
  platform: Platform;
  /** ISO-8601 UTC */
  publishedAt: string;
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  /** Instagram only; 0 for Facebook */
  saves: number;
  /** (likes + comments + shares + saves) / reach × 100 */
  engagementRate: number;
  /** First 100 chars of the published caption — gives Claude content context */
  captionPreview?: string;
  /** Visual tags from EditorAgent — used to identify content-type patterns */
  visualTags?: string[];
}

/** Account-level metrics for the analysis period */
export interface AccountMetrics {
  platform: Platform;
  /** Follower count at the start of the period */
  followersStart: number;
  /** Follower count at the end of the period */
  followersEnd: number;
  followersGained: number;
  profileVisits: number;
  websiteClicks: number;
  totalReach: number;
  totalImpressions: number;
}

/** Community performance data — pass CommunityAgent summary fields directly */
export interface CommunityMetrics {
  totalInteractions: number;
  autoResponded: number;
  escalated: number;
  /** 0.0 (all negative) → 1.0 (all positive) from CommunityAgent.sentimentScore() */
  sentimentScore: number;
  sentimentBreakdown: SentimentBreakdown;
}

/** Publishing execution stats for the period */
export interface PlannerMetrics {
  plannedPosts: number;
  publishedPosts: number;
  pendingApproval: number;
  rejected: number;
  /** publishedPosts / plannedPosts × 100 */
  completionRate: number;
}

/** Snapshot of key metrics from the previous period for delta calculation */
export interface PreviousPeriodSnapshot {
  avgEngagementRate: number;
  totalReach: number;
  followersGained: number;
  sentimentScore: number;
  publishedPosts: number;
}

export interface AnalystInput {
  period: { month: number; year: number };
  postMetrics: PostMetrics[];
  accountMetrics: AccountMetrics[];
  communityMetrics: CommunityMetrics;
  plannerMetrics: PlannerMetrics;
  /** When provided Claude includes month-over-month delta commentary */
  previousPeriod?: PreviousPeriodSnapshot;
}

// ─── Output ───────────────────────────────────────────────────────────────────

/** Four-dimension performance scorecard */
export interface PerformanceScores {
  /** Weighted aggregate of the four dimensions below */
  overall: number;     // 0–10
  /** Average engagement rate + top-post consistency */
  content: number;     // 0–10
  /** Sentiment score + response rate */
  community: number;   // 0–10
  /** Follower growth + reach trends */
  growth: number;      // 0–10
  /** Calendar execution (published / planned) */
  execution: number;   // 0–10
}

export interface PostHighlight {
  postId: string;
  contentPieceId: string;
  platform: Platform;
  engagementRate: number;
  reach: number;
  /** One-sentence explanation of why this post performed as it did */
  performanceFactor: string;
}

export type InsightType = 'strength' | 'weakness' | 'opportunity' | 'threat';

export interface Insight {
  type: InsightType;
  title: string;
  description: string;
  /** Supporting metric or data point, e.g. "avg engagement 4.2% vs 2.1% sector benchmark" */
  supportingMetric?: string;
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  /** Concrete action for next month, written for a non-technical business owner */
  action: string;
  rationale: string;
  /** E.g. "+15% engagement" or "reduce escalations by 30%" */
  estimatedImpact: string;
}

export interface PlatformBreakdown {
  platform: Platform;
  postCount: number;
  avgEngagementRate: number;
  totalReach: number;
  followersGained: number;
}

export interface AnalystOutput {
  period: { month: number; year: number };
  scores: PerformanceScores;
  /** Top 3 posts by engagement rate */
  topPosts: PostHighlight[];
  /** Bottom 1–2 posts — learning opportunities */
  lowPosts: PostHighlight[];
  insights: Insight[];
  recommendations: Recommendation[];
  platformBreakdowns: PlatformBreakdown[];
  /**
   * Full natural-language report in Markdown.
   * Written for a non-technical business owner — no jargon.
   * Rendered in the Postly dashboard report view.
   */
  report: string;
  generatedAt: string;
}
