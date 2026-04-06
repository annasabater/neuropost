// =============================================================================
// NEUROPOST — Central TypeScript Types
// =============================================================================

// ─── Primitive Unions ─────────────────────────────────────────────────────────

export type Platform        = 'instagram' | 'facebook';
export type SocialSector    = 'heladeria' | 'restaurante' | 'cafeteria' | 'gym' | 'clinica' | 'barberia' | 'boutique' | 'inmobiliaria'
  | 'panaderia' | 'cocteleria' | 'street_food' | 'vinoteca'
  | 'nail_art' | 'estetica' | 'maquillaje'
  | 'moda_hombre' | 'zapateria' | 'skincare'
  | 'yoga' | 'dental' | 'clinica_estetica' | 'nutricion'
  | 'decoracion' | 'jardineria' | 'reformas' | 'inmobiliaria_lujo'
  | 'fotografia' | 'academia' | 'abogado' | 'veterinario' | 'mecanica'
  | 'teatro' | 'arte' | 'libreria' | 'gaming' | 'viajes' | 'hotel'
  | 'floristeria' | 'regalos' | 'tecnologia'
  | 'otro';
export type BrandTone       = 'cercano' | 'profesional' | 'divertido' | 'premium';
export type PublishMode     = 'manual' | 'semi' | 'auto';
export type SubscriptionPlan = 'starter' | 'pro' | 'total' | 'agency';
export type VisualStyle     = 'creative' | 'elegant' | 'warm' | 'dynamic' | 'editorial' | 'dark' | 'fresh' | 'vintage';
export type PostStatus      = 'draft' | 'generated' | 'pending' | 'approved' | 'scheduled' | 'published' | 'failed' | 'cancelled';
export type PostFormat      = 'image' | 'reel' | 'carousel' | 'story';
export type CommentStatus   = 'pending' | 'replied' | 'ignored' | 'escalated';
export type Sentiment       = 'positive' | 'neutral' | 'negative';
export type NotificationType = 'approval_needed' | 'published' | 'failed' | 'comment' | 'limit_reached' | 'meta_connected' | 'token_expired' | 'payment_failed' | 'plan_activated' | 'team_invite';
export type PostGoal        = 'engagement' | 'awareness' | 'promotion' | 'community';
export type EditingLevel    = 0 | 1 | 2;

// ─── Database: Brand ──────────────────────────────────────────────────────────

export interface BrandColors {
  primary:   string;
  secondary: string;
  accent:    string;
}

export interface BrandFonts {
  heading: string;
  body:    string;
}

export interface BrandFaq {
  q: string;
  a: string;
}

export interface BrandRules {
  noPublishDays:          number[];   // 0=Sunday … 6=Saturday
  noEmojis:               boolean;
  noAutoReplyNegative:    boolean;
  forbiddenWords:         string[];
  forbiddenTopics:        string[];
}

export interface Brand {
  id:                     string;
  user_id:                string;
  name:                   string;
  sector:                 SocialSector | null;
  secondary_sectors:      SocialSector[];
  visual_style:           VisualStyle;
  tone:                   BrandTone | null;
  colors:                 BrandColors | null;
  fonts:                  BrandFonts | null;
  slogans:                string[];
  hashtags:               string[];
  location:               string | null;
  services:               string[];
  faq:                    BrandFaq[] | null;
  brand_voice_doc:        string | null;
  ig_account_id:          string | null;
  ig_username:            string | null;
  fb_page_id:             string | null;
  fb_page_name:           string | null;
  ig_access_token:        string | null;
  fb_access_token:        string | null;
  meta_token_expires_at:  string | null;
  auto_publish:           boolean;
  publish_mode:           PublishMode;
  rules:                  BrandRules | null;
  plan:                   SubscriptionPlan;
  stripe_customer_id:     string | null;
  stripe_subscription_id: string | null;
  plan_started_at:        string | null;
  trial_ends_at:          string | null;
  plan_cancels_at:        string | null;
  notify_email_publish:   boolean;
  notify_email_comments:  boolean;
  posts_this_week:        number;
  stories_this_week:      number;
  token_refreshed_at:     string | null;
  created_at:             string;
}

// ─── Database: Profile ────────────────────────────────────────────────────────

export interface Profile {
  id:         string;
  full_name:  string | null;
  avatar_url: string | null;
  timezone:   string;
  language:   string;
  created_at: string;
  updated_at: string;
}

// ─── Database: TeamMember ─────────────────────────────────────────────────────

export type TeamRole   = 'admin' | 'editor' | 'approver' | 'analyst';
export type TeamStatus = 'pending' | 'active';

export interface TeamMember {
  id:             string;
  brand_id:       string;
  user_id:        string | null;
  invited_email:  string | null;
  role:           TeamRole;
  status:         TeamStatus;
  invite_token:   string | null;
  created_at:     string;
}

// ─── Database: Post ───────────────────────────────────────────────────────────

export interface PostVersion {
  caption:   string;
  hashtags:  string[];
  savedAt:   string;
}

export type StoryType = 'repost' | 'new' | 'auto';

export interface Post {
  id:               string;
  brand_id:         string;
  image_url:        string | null;
  edited_image_url: string | null;
  caption:          string | null;
  hashtags:         string[];
  edit_level:       EditingLevel;
  format:           PostFormat;
  platform:         Platform[];
  status:           PostStatus;
  scheduled_at:     string | null;
  published_at:     string | null;
  ig_post_id:       string | null;
  fb_post_id:       string | null;
  ai_explanation:   string | null;
  quality_score:    number | null;
  versions:         PostVersion[];
  created_by:       string | null;
  approved_by:      string | null;
  metrics:          Record<string, number> | null;
  is_story:         boolean;
  story_type:       StoryType | null;
  created_at:       string;
}

// ─── Database: Comment ────────────────────────────────────────────────────────

export interface Comment {
  id:          string;
  brand_id:    string;
  post_id:     string | null;
  platform:    Platform;
  external_id: string;
  author:      string;
  content:     string;
  sentiment:   Sentiment | null;
  ai_reply:    string | null;
  status:      CommentStatus;
  created_at:  string;
}

// ─── Database: Notification ───────────────────────────────────────────────────

export interface Notification {
  id:         string;
  brand_id:   string;
  type:       NotificationType;
  message:    string;
  read:       boolean;
  metadata:   Record<string, unknown> | null;
  created_at: string;
}

// ─── Database: ActivityLog ────────────────────────────────────────────────────

export interface ActivityLog {
  id:          string;
  brand_id:    string;
  user_id:     string;
  action:      string;
  entity_type: string;
  entity_id:   string | null;
  details:     Record<string, unknown> | null;
  created_at:  string;
}

// ─── Agent Shared Types ───────────────────────────────────────────────────────

export interface BrandVoice {
  tone:            BrandTone;
  keywords:        string[];
  forbiddenWords:  string[];
  sector:          SocialSector;
  language:        string;         // BCP-47 tag e.g. 'es'
  exampleCaptions: string[];
}

export interface SocialAccounts {
  instagramId?:   string;
  facebookPageId?: string;
  accessToken:    string;
}

export interface AgentContext {
  businessId:       string;
  businessName:     string;
  brandVoice:       BrandVoice;
  socialAccounts:   SocialAccounts;
  timezone:         string;          // IANA e.g. 'Europe/Madrid'
  subscriptionTier: SubscriptionPlan;
  brandVoiceDoc?:   string;          // full generated doc
  visualStyle?:     VisualStyle;
  secondarySectors?: SocialSector[];
}

export interface AgentError {
  code:      string;
  message:   string;
  retryable: boolean;
}

export interface AgentMetadata {
  agentName:    string;
  executionId:  string;
  durationMs:   number;
  timestamp:    string;
  tokensUsed?:  number;
}

export interface AgentResult<T> {
  success:  boolean;
  data?:    T;
  error?:   AgentError;
  metadata: AgentMetadata;
}

// ─── EditorAgent ─────────────────────────────────────────────────────────────

export interface CropSuggestion {
  aspectRatio: '1:1' | '4:5' | '16:9';
  focusPoint:  { x: number; y: number };
}

export interface ImageAnalysis {
  isSuitable:        boolean;
  suitabilityReason: string | null;
  dominantColors:    string[];
  composition:       'portrait' | 'landscape' | 'square' | 'unknown';
  mainSubjects:      string[];
  qualityScore:      number;
  qualityIssues:     string[];
  lightingCondition: 'natural' | 'artificial' | 'mixed' | 'dark' | 'overexposed';
  suggestedCrop:     CropSuggestion | null;
}

export interface EditingParameters {
  brightness: number;   // −100 → 100
  contrast:   number;
  saturation: number;
  sharpness:  number;   // 0 → 100
  warmth:     number;
  vignette:   number;
  filter:     string | null;
}

export interface EditorInput {
  image:        string;           // base64 or URL
  imageType:    'base64' | 'url';
  mimeType:     'image/jpeg' | 'image/png' | 'image/webp';
  editingLevel: EditingLevel;
  photoContext?: string;
}

export interface EditorOutput {
  analysis:          ImageAnalysis;
  editingParameters: EditingParameters | null;
  editingNarrative:  string | null;
  visualTags:        string[];
}

// ─── CopywriterAgent ─────────────────────────────────────────────────────────

export interface PlatformCopy {
  caption:   string;
  charCount: number;
}

export interface HashtagSet {
  branded: string[];
  niche:   string[];
  broad:   string[];
}

export interface CopywriterInput {
  visualTags:    string[];
  imageAnalysis: ImageAnalysis;
  goal:          PostGoal;
  platforms:     Platform[];
  postContext?:  string;
  product?: {
    name:         string;
    price?:       string;
    description?: string;
  };
}

export interface CopywriterOutput {
  copies:          Partial<Record<Platform, PlatformCopy>>;
  hashtags:        HashtagSet;
  callToAction:    string;
  altText:         string;
  strategySummary: string;
}

// ─── PlannerAgent ─────────────────────────────────────────────────────────────

export interface ContentPiece {
  id:            string;
  goal:          PostGoal;
  visualTags:    string[];
  platforms:     Platform[];
  preferredDate?: string;  // ISO YYYY-MM-DD
}

export interface ScheduledPost {
  id:           string;
  contentPieceId: string;
  date:         string;      // ISO YYYY-MM-DD
  time:         string;      // HH:mm
  scheduledAt:  string;      // ISO-8601 UTC
  platform:     Platform;
  rationale:    string;
  isHoliday:    boolean;
  holidayName?: string | null;
}

export interface BestTimeInsight {
  platform: Platform;
  bestDay:  string;
  bestTime: string;
  reason:   string;
}

export interface CalendarDay {
  date:         string;
  dayOfWeek:    string;
  isWeekend:    boolean;
  isHoliday:    boolean;
  holidayName?: string;
  posts:        ScheduledPost[];
}

export interface PlannerInput {
  month:         number;       // 1–12
  year:          number;
  contentPieces: ContentPiece[];
  postsPerWeek:  number;
  country:       string;       // ISO 3166-1 alpha-2
  platforms:     Platform[];
  blackoutDates?: string[];
}

export interface PlannerOutput {
  month:              number;
  year:               number;
  calendar:           CalendarDay[];
  scheduledPosts:     ScheduledPost[];
  bestTimeInsights:   BestTimeInsight[];
  unscheduledPieceIds: string[];
  summary:            string;
}

// ─── IdeasAgent ───────────────────────────────────────────────────────────────

export interface IdeaItem {
  title:     string;
  format:    PostFormat;
  caption:   string;
  hashtags:  string[];
  bestTime:  string;
  rationale: string;
  goal:      PostGoal;
}

export interface IdeasInput {
  prompt:    string;
  count:     number;          // default 10
}

export interface IdeasOutput {
  ideas: IdeaItem[];
}

// ─── CommunityAgent ───────────────────────────────────────────────────────────

export type InteractionType     = 'comment' | 'dm';
export type InteractionCategory = 'question' | 'complaint' | 'compliment' | 'spam' | 'general' | 'crisis';
export type Priority            = 'urgent' | 'normal' | 'low';
export type ResponseDecision    = 'auto_respond' | 'escalate' | 'ignore';

export interface Interaction {
  id:               string;
  type:             InteractionType;
  platform:         Platform;
  authorId:         string;
  authorName:       string;
  text:             string;
  timestamp:        string;
  postId?:          string;
  parentCommentId?: string;
  isVerified?:      boolean;
}

export interface InteractionAnalysis {
  category:                InteractionCategory;
  sentiment:               Sentiment;
  priority:                Priority;
  decision:                ResponseDecision;
  escalationReason?:       string;
  detectedLanguage:        string;
  containsSensitiveContent: boolean;
  keywords:                string[];
}

export interface InteractionResponse {
  interactionId:  string;
  analysis:       InteractionAnalysis;
  generatedReply?: string;
  replyPosted:    boolean;
  metaReplyId?:   string;
  postedAt?:      string;
  postingError?:  string;
}

export interface SentimentBreakdown {
  positive: number;
  neutral:  number;
  negative: number;
}

export interface CategoryBreakdown {
  question:   number;
  complaint:  number;
  compliment: number;
  spam:       number;
  general:    number;
  crisis:     number;
}

export interface CommunitySummary {
  total:                 number;
  autoResponded:         number;
  escalated:             number;
  ignored:               number;
  repliesPosted:         number;
  sentimentBreakdown:    SentimentBreakdown;
  categoryBreakdown:     CategoryBreakdown;
  urgentInteractionIds:  string[];
  digest:                string;
}

export interface CommunityInput {
  interactions:    Interaction[];
  autoPostReplies: boolean;
}

export interface CommunityOutput {
  responses: InteractionResponse[];
  summary:   CommunitySummary;
}

// ─── AnalystAgent ─────────────────────────────────────────────────────────────

export interface PostMetrics {
  postId:          string;
  contentPieceId:  string;
  platform:        Platform;
  publishedAt:     string;
  reach:           number;
  impressions:     number;
  likes:           number;
  comments:        number;
  shares:          number;
  saves:           number;
  engagementRate:  number;
  captionPreview?: string;
  visualTags?:     string[];
}

export interface AccountMetrics {
  platform:         Platform;
  followersStart:   number;
  followersEnd:     number;
  followersGained:  number;
  profileVisits:    number;
  websiteClicks:    number;
  totalReach:       number;
  totalImpressions: number;
}

export interface CommunityMetrics {
  totalInteractions:   number;
  autoResponded:       number;
  escalated:           number;
  sentimentScore:      number;     // 0.0–1.0
  sentimentBreakdown:  SentimentBreakdown;
}

export interface PlannerMetrics {
  plannedPosts:    number;
  publishedPosts:  number;
  pendingApproval: number;
  rejected:        number;
  completionRate:  number;
}

export interface PreviousPeriodSnapshot {
  avgEngagementRate: number;
  totalReach:        number;
  followersGained:   number;
  sentimentScore:    number;
  publishedPosts:    number;
}

export interface AnalystInput {
  period:           { month: number; year: number };
  postMetrics:      PostMetrics[];
  accountMetrics:   AccountMetrics[];
  communityMetrics: CommunityMetrics;
  plannerMetrics:   PlannerMetrics;
  previousPeriod?:  PreviousPeriodSnapshot;
}

export interface PerformanceScores {
  overall:   number;   // 0–10
  content:   number;
  community: number;
  growth:    number;
  execution: number;
}

export type InsightType = 'strength' | 'weakness' | 'opportunity' | 'threat';

export interface Insight {
  type:             InsightType;
  title:            string;
  description:      string;
  supportingMetric?: string;
}

export interface Recommendation {
  priority:        'high' | 'medium' | 'low';
  action:          string;
  rationale:       string;
  estimatedImpact: string;
}

export interface PostHighlight {
  postId:           string;
  contentPieceId:   string;
  platform:         Platform;
  engagementRate:   number;
  reach:            number;
  performanceFactor: string;
}

export interface PlatformBreakdown {
  platform:          Platform;
  postCount:         number;
  avgEngagementRate: number;
  totalReach:        number;
  followersGained:   number;
}

export interface AnalystOutput {
  period:             { month: number; year: number };
  scores:             PerformanceScores;
  topPosts:           PostHighlight[];
  lowPosts:           PostHighlight[];
  insights:           Insight[];
  recommendations:    Recommendation[];
  platformBreakdowns: PlatformBreakdown[];
  report:             string;   // Markdown
  generatedAt:        string;
}

// ─── Supabase DB helper type ───────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseRelationships = any[];

export interface Database {
  public: {
    Tables: {
      brands:        { Row: Brand;        Insert: Partial<Brand>;        Update: Partial<Brand>;        Relationships: SupabaseRelationships };
      posts:         { Row: Post;         Insert: Partial<Post>;         Update: Partial<Post>;         Relationships: SupabaseRelationships };
      comments:      { Row: Comment;      Insert: Partial<Comment>;      Update: Partial<Comment>;      Relationships: SupabaseRelationships };
      notifications: { Row: Notification; Insert: Partial<Notification>; Update: Partial<Notification>; Relationships: SupabaseRelationships };
      activity_log:  { Row: ActivityLog;  Insert: Partial<ActivityLog>;  Update: Partial<ActivityLog>;  Relationships: SupabaseRelationships };
      profiles:      { Row: Profile;      Insert: Partial<Profile>;      Update: Partial<Profile>;      Relationships: SupabaseRelationships };
      team_members:  { Row: TeamMember;   Insert: Partial<TeamMember>;   Update: Partial<TeamMember>;   Relationships: SupabaseRelationships };
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Views: Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Functions: Record<string, any>;
  };
}

// ─── Plan limits ──────────────────────────────────────────────────────────────

export const PLAN_LIMITS: Record<SubscriptionPlan, {
  postsPerMonth:    number;
  postsPerWeek:     number;
  storiesPerWeek:   number;
  brands:           number;
  platforms:        number;
  autoPublish:      boolean;
  competitorAgent:  boolean;
  trendsAgent:      boolean;
  autoComments:     boolean;
}> = {
  starter: { postsPerMonth: Infinity, postsPerWeek: 2,  storiesPerWeek: 0,  brands: 1,  platforms: 1, autoPublish: false, competitorAgent: false, trendsAgent: false, autoComments: false },
  pro:     { postsPerMonth: Infinity, postsPerWeek: 5,  storiesPerWeek: 3,  brands: 1,  platforms: 2, autoPublish: true,  competitorAgent: false, trendsAgent: false, autoComments: false },
  total:   { postsPerMonth: Infinity, postsPerWeek: 7,  storiesPerWeek: 7,  brands: 1,  platforms: 2, autoPublish: true,  competitorAgent: true,  trendsAgent: true,  autoComments: true  },
  agency:  { postsPerMonth: Infinity, postsPerWeek: 7,  storiesPerWeek: 7,  brands: 10, platforms: 2, autoPublish: true,  competitorAgent: true,  trendsAgent: true,  autoComments: true  },
};

// ─── Worker Portal Types ──────────────────────────────────────────────────────

export type WorkerRole   = 'worker' | 'senior' | 'admin';
export type QueueStatus  = 'pending_worker' | 'worker_approved' | 'worker_rejected' | 'sent_to_client' | 'client_approved' | 'client_rejected';
export type QueuePriority = 'normal' | 'urgent';
export type QueueType    = 'edit_request' | 'ai_proposal' | 'direct';
export type ClientEditMode = 'proposal' | 'instant';

export interface Worker {
  id:                string;
  full_name:         string | null;
  email:             string | null;
  role:              WorkerRole;
  avatar_url:        string | null;
  is_active:         boolean;
  brands_assigned:   string[];
  specialties:       string[];
  notes:             string | null;
  joined_at:         string;
}

export interface ContentQueue {
  id:                    string;
  brand_id:              string;
  post_id:               string;
  type:                  QueueType;
  status:                QueueStatus;
  assigned_worker_id:    string | null;
  worker_notes:          string | null;
  worker_reviewed_at:    string | null;
  client_feedback:       string | null;
  priority:              QueuePriority;
  regeneration_count:    number;
  regeneration_history:  RegenerationEntry[];
  created_at:            string;
}

export interface RegenerationEntry {
  prompt:     string;
  result_url: string | null;
  created_at: string;
}

export interface FeedQueue {
  id:           string;
  brand_id:     string;
  post_id:      string | null;
  image_url:    string | null;
  position:     number;
  is_published: boolean;
  scheduled_at: string | null;
  created_at:   string;
}

export interface ClientNote {
  id:         string;
  brand_id:   string;
  worker_id:  string;
  note:       string;
  is_pinned:  boolean;
  created_at: string;
}

export interface WorkerMessage {
  id:              string;
  brand_id:        string | null;
  from_worker_id:  string;
  to_worker_id:    string | null;
  message:         string;
  read:            boolean;
  created_at:      string;
}

export interface ClientActivityLog {
  id:         string;
  brand_id:   string;
  action:     string;
  details:    Record<string, unknown> | null;
  created_at: string;
}
