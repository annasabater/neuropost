// ─────────────────────────────────────────────────────────────────────────────
// Postly — AnalystAgent prompts
// ─────────────────────────────────────────────────────────────────────────────

import type { AgentContext } from '../shared/types.js';
import type { AnalystInput, PostMetrics } from './types.js';

// ─── Sector engagement benchmarks ────────────────────────────────────────────

const SECTOR_BENCHMARKS: Record<string, { engagementRate: string; followersGrowth: string }> = {
  restaurant:  { engagementRate: '2.5–4.0%', followersGrowth: '1.5–3% / month' },
  'ice-cream': { engagementRate: '3.0–5.5%', followersGrowth: '2.0–4% / month' },
  retail:      { engagementRate: '1.5–3.0%', followersGrowth: '1.0–2.5% / month' },
  other:       { engagementRate: '1.5–3.5%', followersGrowth: '1.0–3% / month' },
};

// ─── System prompt ────────────────────────────────────────────────────────────

/**
 * Establishes Claude as a data-literate marketing analyst who communicates
 * complex metrics in plain language for small business owners.
 */
export function buildAnalystSystemPrompt(context: AgentContext): string {
  const benchmarks =
    SECTOR_BENCHMARKS[context.brandVoice.sector] ?? SECTOR_BENCHMARKS['other']!;

  return `You are a social media performance analyst for ${context.businessName}, a ${context.brandVoice.sector} business.

## Your role
Turn raw social media metrics into clear, actionable insights that a small business owner can read in under 5 minutes and immediately act on.

## Sector benchmarks — ${context.brandVoice.sector}
- Engagement rate (good): ${benchmarks.engagementRate}
- Follower growth (healthy): ${benchmarks.followersGrowth}
- Use these as reference points — flag when results are above or below benchmark.

## Communication rules
1. Write the report in ${context.brandVoice.language}.
2. Avoid marketing jargon. Replace: "KPIs" → "key numbers", "CTR" → "link clicks rate", "impressions" → "times seen".
3. Always link observations to business outcomes: more reach → more people know us → more customers.
4. Be specific with numbers; round to one decimal place.
5. Keep tone ${context.brandVoice.tone} — match the brand personality.
6. Scores (0–10) must be integers.

## Report structure (Markdown, ~600 words)
# [Month Year] Social Media Report — ${context.businessName}
## How did we do this month? (overall score + 2-sentence summary)
## Numbers at a glance (key metrics table)
## What worked well (top posts, strengths)
## What we can improve (weaknesses, low posts)
## Community pulse (sentiment, interactions)
## Recommendations for next month (numbered, action-oriented)

Return ONLY valid JSON. No markdown outside the JSON string values.`;
}

// ─── User prompt ──────────────────────────────────────────────────────────────

const OUTPUT_SCHEMA = `{
  "scores": {
    "overall":   number,   // 0–10
    "content":   number,
    "community": number,
    "growth":    number,
    "execution": number
  },
  "topPosts": [
    {
      "postId": string,
      "contentPieceId": string,
      "platform": "instagram" | "facebook",
      "engagementRate": number,
      "reach": number,
      "performanceFactor": string
    }
  ],
  "lowPosts": [...same shape as topPosts...],
  "insights": [
    {
      "type": "strength" | "weakness" | "opportunity" | "threat",
      "title": string,
      "description": string,
      "supportingMetric": string | null
    }
  ],
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "action": string,
      "rationale": string,
      "estimatedImpact": string
    }
  ],
  "platformBreakdowns": [
    {
      "platform": "instagram" | "facebook",
      "postCount": number,
      "avgEngagementRate": number,
      "totalReach": number,
      "followersGained": number
    }
  ],
  "report": string   // full Markdown report as a single escaped string
}`;

/** Formats post metrics as a compact table for the prompt */
function formatPostTable(posts: PostMetrics[]): string {
  if (posts.length === 0) return '  (no posts this period)';

  return posts
    .map(
      (p) =>
        `  • [${p.platform}] ${p.publishedAt.slice(0, 10)} | reach ${p.reach} | eng ${p.engagementRate.toFixed(1)}% | likes ${p.likes} | comments ${p.comments} | shares ${p.shares} | saves ${p.saves}${p.captionPreview ? ` | "${p.captionPreview.slice(0, 60)}..."` : ''}${p.visualTags?.length ? ` | tags: [${p.visualTags.slice(0, 4).join(', ')}]` : ''}`,
    )
    .join('\n');
}

/**
 * Builds the full analyst brief as the user turn.
 */
export function buildAnalystUserPrompt(input: AnalystInput, context: AgentContext): string {
  const monthName = new Date(input.period.year, input.period.month - 1, 1).toLocaleString(
    'en-US',
    { month: 'long' },
  );

  // Account metrics per platform
  const accountBlock = input.accountMetrics
    .map(
      (a) =>
        `  [${a.platform}] followers: ${a.followersStart}→${a.followersEnd} (+${a.followersGained}) | reach: ${a.totalReach} | profile visits: ${a.profileVisits} | website clicks: ${a.websiteClicks}`,
    )
    .join('\n');

  // Previous period delta
  const prevBlock = input.previousPeriod
    ? `Previous period:
  avg engagement rate: ${input.previousPeriod.avgEngagementRate.toFixed(1)}%
  total reach: ${input.previousPeriod.totalReach}
  followers gained: ${input.previousPeriod.followersGained}
  sentiment score: ${(input.previousPeriod.sentimentScore * 100).toFixed(0)}%
  published posts: ${input.previousPeriod.publishedPosts}`
    : 'Previous period: not available (first month)';

  return `Analyse the social media performance for ${context.businessName} — ${monthName} ${input.period.year}.

## Post performance (${input.postMetrics.length} posts)
${formatPostTable(input.postMetrics)}

## Account growth
${accountBlock}

## Community (${input.communityMetrics.totalInteractions} interactions)
  Sentiment score: ${(input.communityMetrics.sentimentScore * 100).toFixed(0)}%
  Breakdown: ${input.communityMetrics.sentimentBreakdown.positive} positive, ${input.communityMetrics.sentimentBreakdown.neutral} neutral, ${input.communityMetrics.sentimentBreakdown.negative} negative
  Auto-responded: ${input.communityMetrics.autoResponded} | Escalated: ${input.communityMetrics.escalated}

## Publishing execution
  Planned: ${input.plannerMetrics.plannedPosts} | Published: ${input.plannerMetrics.publishedPosts} | Completion: ${input.plannerMetrics.completionRate.toFixed(0)}%
  Pending approval: ${input.plannerMetrics.pendingApproval} | Rejected: ${input.plannerMetrics.rejected}

## ${prevBlock}

Instructions:
- Select top 3 posts by engagement rate for "topPosts".
- Select bottom 1–2 posts for "lowPosts" (minimum 1 if any posts exist).
- Generate 4–6 insights (mix of strengths, weaknesses, opportunities).
- Generate 3–5 recommendations ordered by priority.
- Write the full Markdown report (~600 words) in the "report" field.
- Compare against sector benchmarks where relevant.
- Include month-over-month deltas if previous period data is provided.

Return this exact JSON:
${OUTPUT_SCHEMA}`;
}
