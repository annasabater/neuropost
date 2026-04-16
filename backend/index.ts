// =============================================================================
// @neuropost/agents — Public API
// All agent run-functions and their types, exported for use by the Next.js app.
// =============================================================================

// ─── Shared types ─────────────────────────────────────────────────────────────
export type {
  AgentContext,
  AgentResult,
  AgentError,
  AgentMetadata,
  BrandVoice,
  SocialAccounts,
  SocialSector,
  BrandTone,
  SubscriptionPlan,
  SubscriptionTier,
} from './agents/shared/types';

// ─── Editor ───────────────────────────────────────────────────────────────────
export type {
  EditorInput,
  EditorOutput,
  ImageAnalysis,
  EditingParameters,
  CropSuggestion,
  EditingLevel,
} from './agents/editor/types';

import { EditorAgent } from './agents/editor/editor-agent';
import type { AgentContext } from './agents/shared/types';
import type { AgentResult } from './agents/shared/types';
import type { EditorInput, EditorOutput } from './agents/editor/types';
import type { CopywriterInput, CopywriterOutput } from './agents/copywriter/types';
import type { IdeasInput, IdeasOutput } from './agents/ideas/types';
import type { PlannerInput, PlannerOutput } from './agents/planner/types';
import type { CommunityInput, CommunityOutput } from './agents/community/types';
import type { AnalystInput, AnalystOutput } from './agents/analyst/types';
import type { PublisherInput, PublisherOutput } from './agents/publisher/types';
import type { SupportInput, SupportOutput } from './agents/support/types';

import { CopywriterAgent } from './agents/copywriter/copywriter-agent';
import { IdeasAgent } from './agents/ideas/ideas-agent';
import { PlannerAgent } from './agents/planner/planner-agent';
import { CommunityAgent } from './agents/community/community-agent';
import { AnalystAgent } from './agents/analyst/analyst-agent';
import { PublisherAgent } from './agents/publisher/publisher-agent';
import { SupportAgent } from './agents/support/support-agent';

// ─── Copywriter ───────────────────────────────────────────────────────────────
export type {
  CopywriterInput,
  CopywriterOutput,
  PlatformCopy,
  HashtagSet,
  PostGoal,
  Platform,
} from './agents/copywriter/types';

// ─── Ideas ────────────────────────────────────────────────────────────────────
export type {
  IdeasInput,
  IdeasOutput,
  IdeaItem,
  PostFormat,
} from './agents/ideas/types';

// ─── Planner ──────────────────────────────────────────────────────────────────
export type {
  PlannerInput,
  PlannerOutput,
  ScheduledPost,
  CalendarDay,
  ContentPiece,
  BestTimeInsight,
} from './agents/planner/types';

// ─── Community ────────────────────────────────────────────────────────────────
export type {
  CommunityInput,
  CommunityOutput,
  Interaction,
  InteractionResponse,
  CommunitySummary,
  InteractionType,
  InteractionCategory,
  Sentiment,
  Priority,
  ResponseDecision,
  InteractionAnalysis,
  SentimentBreakdown,
  CategoryBreakdown,
} from './agents/community/types';

// ─── Analyst ──────────────────────────────────────────────────────────────────
export type {
  AnalystInput,
  AnalystOutput,
  PostMetrics,
  AccountMetrics,
  CommunityMetrics,
  PlannerMetrics,
  PerformanceScores,
  Insight,
  InsightType,
  Recommendation,
  PostHighlight,
  PlatformBreakdown,
  PreviousPeriodSnapshot,
} from './agents/analyst/types';

// ─── Publisher ────────────────────────────────────────────────────────────────
export type {
  PublisherInput,
  PublisherOutput,
  BrandSafetyCheck,
  SafetyRecommendation,
  PublishStatus,
} from './agents/publisher/types';

// ─── Support ──────────────────────────────────────────────────────────────────
export type {
  SupportInput,
  SupportOutput,
  SupportSource,
  SupportCategory,
  SupportSolutionStep,
  SupportMessageHistoryItem,
} from './agents/support/types';

// ─── Run functions ────────────────────────────────────────────────────────────

export function runEditorAgent(
  input: EditorInput,
  ctx: AgentContext,
): Promise<AgentResult<EditorOutput>> {
  return new EditorAgent().run(input, ctx);
}

export function runCopywriterAgent(
  input: CopywriterInput,
  ctx: AgentContext,
): Promise<AgentResult<CopywriterOutput>> {
  return new CopywriterAgent().run(input, ctx);
}

export function runIdeasAgent(
  input: IdeasInput,
  ctx: AgentContext,
): Promise<AgentResult<IdeasOutput>> {
  return new IdeasAgent().run(input, ctx);
}

export function runPlannerAgent(
  input: PlannerInput,
  ctx: AgentContext,
): Promise<AgentResult<PlannerOutput>> {
  return new PlannerAgent().run(input, ctx);
}

export function runCommunityAgent(
  input: CommunityInput,
  ctx: AgentContext,
): Promise<AgentResult<CommunityOutput>> {
  return new CommunityAgent().run(input, ctx);
}

export function runAnalystAgent(
  input: AnalystInput,
  ctx: AgentContext,
): Promise<AgentResult<AnalystOutput>> {
  return new AnalystAgent().run(input, ctx);
}

export function runPublisherAgent(
  input: PublisherInput,
  ctx: AgentContext,
): Promise<AgentResult<PublisherOutput>> {
  return new PublisherAgent().run(input, ctx);
}

export function runSupportAgent(
  input: SupportInput,
  ctx: AgentContext,
): Promise<AgentResult<SupportOutput>> {
  return new SupportAgent().run(input, ctx);
}
