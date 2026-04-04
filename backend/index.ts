// =============================================================================
// @postly/agents — Public API
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
} from './agents/shared/types.js';

// ─── Editor ───────────────────────────────────────────────────────────────────
export type {
  EditorInput,
  EditorOutput,
  ImageAnalysis,
  EditingParameters,
  CropSuggestion,
  EditingLevel,
} from './agents/editor/types.js';

import { EditorAgent } from './agents/editor/editor-agent.js';
import type { AgentContext } from './agents/shared/types.js';
import type { AgentResult } from './agents/shared/types.js';
import type { EditorInput, EditorOutput } from './agents/editor/types.js';
import type { CopywriterInput, CopywriterOutput } from './agents/copywriter/types.js';
import type { IdeasInput, IdeasOutput } from './agents/ideas/types.js';
import type { PlannerInput, PlannerOutput } from './agents/planner/types.js';
import type { CommunityInput, CommunityOutput } from './agents/community/types.js';
import type { AnalystInput, AnalystOutput } from './agents/analyst/types.js';
import type { PublisherInput, PublisherOutput } from './agents/publisher/types.js';

import { CopywriterAgent } from './agents/copywriter/copywriter-agent.js';
import { IdeasAgent } from './agents/ideas/ideas-agent.js';
import { PlannerAgent } from './agents/planner/planner-agent.js';
import { CommunityAgent } from './agents/community/community-agent.js';
import { AnalystAgent } from './agents/analyst/analyst-agent.js';
import { PublisherAgent } from './agents/publisher/publisher-agent.js';

// ─── Copywriter ───────────────────────────────────────────────────────────────
export type {
  CopywriterInput,
  CopywriterOutput,
  PlatformCopy,
  HashtagSet,
  PostGoal,
  Platform,
} from './agents/copywriter/types.js';

// ─── Ideas ────────────────────────────────────────────────────────────────────
export type {
  IdeasInput,
  IdeasOutput,
  IdeaItem,
  PostFormat,
} from './agents/ideas/types.js';

// ─── Planner ──────────────────────────────────────────────────────────────────
export type {
  PlannerInput,
  PlannerOutput,
  ScheduledPost,
  CalendarDay,
  ContentPiece,
  BestTimeInsight,
} from './agents/planner/types.js';

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
} from './agents/community/types.js';

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
} from './agents/analyst/types.js';

// ─── Publisher ────────────────────────────────────────────────────────────────
export type {
  PublisherInput,
  PublisherOutput,
  BrandSafetyCheck,
  SafetyRecommendation,
  PublishStatus,
} from './agents/publisher/types.js';

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
