// =============================================================================
// NEUROPOST — Central TypeScript Types
// =============================================================================

// ─── Primitive Unions ─────────────────────────────────────────────────────────

export type Platform        = 'instagram' | 'facebook' | 'tiktok';
export type SocialSector    = 'heladeria' | 'restaurante' | 'cafeteria' | 'gym' | 'clinica' | 'barberia' | 'boutique' | 'inmobiliaria'
  | 'panaderia' | 'cocteleria' | 'street_food' | 'vinoteca'
  | 'nail_art' | 'estetica' | 'maquillaje' | 'peluqueria' | 'tattoo'
  | 'moda_hombre' | 'zapateria' | 'skincare'
  | 'yoga' | 'dental' | 'clinica_estetica' | 'nutricion' | 'psicologia' | 'fisioterapia'
  | 'decoracion' | 'jardineria' | 'reformas' | 'inmobiliaria_lujo' | 'arquitectura'
  | 'fotografia' | 'academia' | 'abogado' | 'veterinario' | 'mecanica' | 'consultoria'
  | 'teatro' | 'arte' | 'libreria' | 'gaming' | 'viajes' | 'hotel'
  | 'floristeria' | 'regalos' | 'tecnologia' | 'ecommerce' | 'agencia_marketing'
  // Turismo y alojamiento
  | 'hostal' | 'casa_rural' | 'camping' | 'agencia_viajes'
  // Cultura y ocio
  | 'museo' | 'galeria' | 'sala_conciertos' | 'cine' | 'escape_room'
  // Educación y formación
  | 'escuela' | 'guarderia' | 'academia_idiomas' | 'academia_musica' | 'academia_deporte'
  // Deporte y aventura
  | 'centro_deportivo' | 'parque_acuatico' | 'aventura' | 'club_deportivo' | 'padel'
  // Ocio y familia
  | 'centro_ludico' | 'parque_infantil' | 'zoo' | 'acuario'
  // Eventos y servicios
  | 'organizacion_eventos' | 'catering' | 'ong' | 'coworking'
  | 'otro';
export type BrandTone       = 'cercano' | 'profesional' | 'divertido' | 'premium';
export type PublishMode     = 'manual' | 'semi' | 'auto';
export type SubscriptionPlan = 'starter' | 'pro' | 'total';
export type VisualStyle     = 'creative' | 'elegant' | 'warm' | 'dynamic' | 'editorial' | 'dark' | 'fresh' | 'vintage';
export type PostStatus      = 'request' | 'draft' | 'generated' | 'pending' | 'approved' | 'scheduled' | 'published' | 'failed' | 'cancelled' | 'needs_human_review';
export type CategorySource  = 'template' | 'user' | 'ai_suggested';
export type PostFormat      = 'image' | 'video' | 'reel' | 'carousel' | 'story';
export type SourceType      = 'photos' | 'video' | 'none';
export type CommentStatus   = 'pending' | 'replied' | 'ignored' | 'escalated';
export type Sentiment       = 'positive' | 'neutral' | 'negative';
export type NotificationType =
  | 'approval_needed' | 'published' | 'failed' | 'comment' | 'limit_reached'
  | 'meta_connected' | 'token_expired' | 'payment_failed' | 'plan_activated' | 'team_invite'
  | 'weekly_plan.ready_for_client_review'
  | 'weekly_plan.reminder_day_2'
  | 'weekly_plan.reminder_day_4'
  | 'weekly_plan.final_warning_day_6'
  | 'weekly_plan.auto_approved'
  | 'weekly_plan.material_ready_for_worker'
  | 'weekly_plan.final_calendar_ready'
  | 'post.retouch_requested_by_client'
  | 'weekly_plan.skipped_by_client'
  | 'human_review_needed';
export type PostGoal        = 'engagement' | 'awareness' | 'promotion' | 'community';
export type EditingLevel    = 0 | 1 | 2;

// ─── Human Review Config ──────────────────────────────────────────────────────

export interface HumanReviewConfig {
  messages: boolean;
  images:   boolean;
  videos:   boolean;
  requests: boolean;
}

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

export interface BrandPreferences {
  /** 0=Sunday … 6=Saturday. Empty array means "no preference". */
  preferredDays:      number[];
  /** Desired posts per week. Clamped client-side to PLAN_LIMITS[plan].postsPerWeek. */
  postsPerWeek:       number;
  /** Whether to include videos in the rotation (Pro+ only). */
  includeVideos:      boolean;
  /** Desired videos per week. Clamped to PLAN_LIMITS[plan].videosPerWeek. */
  videosPerWeek:      number;
  /** Whether the user likes carousels. */
  likesCarousels:     boolean;
  /** Preferred photos per carousel. Clamped to PLAN_LIMITS[plan].carouselMaxPhotos. */
  carouselSize:       number;
  /** Preferred posting window — hour of day 0..23. */
  preferredHourStart: number;
  preferredHourEnd:   number;
  /** Whether hashtags are appended to generated posts. */
  hashtagsEnabled:    boolean;
  /** Whether slogans are weaved into generated posts. */
  slogansEnabled:     boolean;
}

/** Structured voice configuration so the editor can reopen pre-selected. */
export interface BrandVoicePreset {
  /** Personality chips (multi-select): cercano, enérgico, premium, … */
  personality:    string[];
  /** Caption length preference: short / medium / long. */
  length:         'short' | 'medium' | 'long';
  /** Tú / usted / mezclado. */
  addressing:     'tu' | 'usted' | 'mixed';
  /** How much the brand tells stories vs. states facts. */
  storytelling:   'low' | 'medium' | 'high';
  /** Free-form extra notes (optional). */
  extraNotes:     string;
}

export interface BrandRules {
  noPublishDays:          number[];   // 0=Sunday … 6=Saturday
  noEmojis:               boolean;
  noAutoReplyNegative:    boolean;
  forbiddenWords:         string[];
  forbiddenTopics:        string[];
  /** Plan-aware publishing preferences. Optional for backwards-compat. */
  preferences?:           BrandPreferences;
  /** Structured voice preset, used to regenerate brand_voice_doc on save. */
  voicePreset?:           BrandVoicePreset;
  /** Custom sector description when sector === 'otro'. */
  sectorOther?:           string;
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
  tt_access_token:        string | null;
  tt_refresh_token:       string | null;
  tt_open_id:             string | null;
  tt_username:            string | null;
  tt_token_expires_at:    string | null;
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
  /** Uploaded logo/avatar URL (optional). */
  logo_url?:              string | null;
  /** Short business description shown in settings and brand kit. */
  description?:           string | null;
  /** Timezone for scheduling — IANA e.g. 'Europe/Madrid'. */
  timezone?:              string | null;
  posts_this_week:        number;
  stories_this_week:      number;
  videos_this_week:       number;
  token_refreshed_at:     string | null;
  /** Platforms the client has subscribed to (paid for). Defaults to ['instagram']. */
  subscribed_platforms:       Platform[];
  created_at:                 string;
  use_new_planning_flow:      boolean;
  human_review_config:        HumanReviewConfig;
  auto_approve_after_days:    number;
  compliance_flags:           Record<string, unknown>;
  /** Weekly content format mix preferences. Applied to the next generated plan. */
  content_mix_preferences?:   { posts?: { carousel?: number; reel?: number }; stories_templates_enabled?: string[] } | null;
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
  image_url?: string | null;   // image snapshot at this version (populated from regenerations)
}

export type PostStoryType = 'repost' | 'new' | 'auto';

export interface Post {
  id:                 string;
  brand_id:           string;
  image_url:          string | null;
  edited_image_url:   string | null;
  caption:            string | null;
  hashtags:           string[];
  edit_level:         EditingLevel;
  format:             PostFormat;
  platform:           Platform[];
  status:             PostStatus;
  scheduled_at:       string | null;
  published_at:       string | null;
  ig_post_id:         string | null;
  fb_post_id:         string | null;
  tt_post_id:         string | null;
  ai_explanation:     string | null;
  quality_score:      number | null;
  versions:           PostVersion[];
  created_by:         string | null;
  approved_by:        string | null;
  metrics:            Record<string, number> | null;
  is_story:           boolean;
  story_type:         PostStoryType | null;
  created_at:         string;
  /** What the client uploaded: photos, a video, or nothing. */
  source_type:        SourceType;
  /** URL of the generated or uploaded video (for video/reel posts). */
  video_url:          string | null;
  /** Desired video duration in seconds (only for video/reel format). */
  video_duration:     number | null;
  /** ISO date of the Monday of the week this post was created (UTC). */
  week_start:         string | null;
  /** Number of photos in this post (1 for single photo, N for carousel). */
  photo_count:        number;
  /** Number of times this post has been regenerated. 0–3 are free. */
  regeneration_count: number;
  /** AI-generated images pending client approval (one per requested photo). */
  generated_images:   string[];
  /** How many images were requested for this post. */
  generation_total:   number;
  /** How many images have been validated and added to generated_images. */
  generation_done:    number;
  /** Timestamp of the last client retouch request for this post. */
  client_retouched_at: string | null;
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
  id:               string;
  brand_id:         string;
  type:             NotificationType;
  message:          string;
  read:             boolean;
  metadata:         Record<string, unknown> | null;
  created_at:       string;
  email_sent_at:    string | null;
  email_resend_id:  string | null;
  email_error:      string | null;
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

// ─── Content Categories ───────────────────────────────────────────────────────

export interface ContentCategory {
  id?:          string;
  brand_id?:    string;
  category_key: string;
  name:         string;          // human-readable label
  source:       CategorySource;
  active:       boolean;
  created_at?:  string;
}

// ─── Image Validations ────────────────────────────────────────────────────────

export interface ImageValidation {
  id:                    string;
  post_id:               string;
  attempt_number:        1 | 2 | 3;
  image_url:             string;
  approved:              boolean;
  confidence:            number;
  issues:                string[];
  suggested_prompt_fix:  string | null;
  original_prompt:       string;
  created_at:            string;
}

// ─── Agent Shared Types ───────────────────────────────────────────────────────

export interface BrandVoice {
  tone:             BrandTone;
  keywords:         string[];
  forbiddenWords:   string[];
  forbiddenTopics:  string[];
  noEmojis:         boolean;
  sector:           SocialSector;
  language:         string;         // BCP-47 tag e.g. 'es'
  exampleCaptions:  string[];
}

export interface SocialAccounts {
  instagramId?:   string;
  facebookPageId?: string;
  accessToken:    string;
}

export interface AgentContext {
  businessId:        string;
  businessName:      string;
  brandVoice:        BrandVoice;
  socialAccounts:    SocialAccounts;
  timezone:          string;          // IANA e.g. 'Europe/Madrid'
  subscriptionTier:  SubscriptionPlan;
  brandVoiceDoc?:    string;          // full generated doc
  visualStyle?:      VisualStyle;
  colors?:           BrandColors | null;
  secondarySectors?: SocialSector[];
  /** Plan-aware publishing preferences (days, carousel size, videos, etc). */
  preferences?:      BrandPreferences;
  // ─── Brief Avanzado fields ────────────────────────────────────────────────
  faqs?:         Array<{ category: string; question: string; answer: string }>;
  products?:     Array<{ name: string; price_cents?: number; currency?: string; main_benefit?: string; is_hero?: boolean }>;
  personas?:     Array<{ persona_name: string; lifestyle?: string; pains: string[]; desires: string[]; lingo_yes: string[]; lingo_no: string[] }>;
  competitors?:  Array<{ name: string; ig_handle?: string; they_do_well?: string; is_direct_competitor: boolean; is_reference: boolean; is_anti_reference: boolean }>;
  complianceFlags?: Record<string, unknown>;
  services?:     string[];
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
  // ── Per-mode limits ──
  autoProposalsPerWeek: number;   // Weekly auto-generated proposals
  videosPerWeek:        number;   // Video generation limit
  requestsPerMonth:     number;   // On-demand requests (pedidos)
  selfServiceActions:   number;   // Self-service editor actions/month
  autopilot:            boolean;  // Auto-publish approved proposals
  inspirationAccess:    boolean;  // Access to inspiration library
  carouselMaxPhotos:    number;   // Max photos per carousel
  // ── Platform access ──
  allowedPlatforms:     Platform[];  // Platforms available for this plan tier
  tiktokAvailable:      boolean;     // Whether TikTok can be subscribed
}> = {
  starter: { postsPerMonth: Infinity, postsPerWeek: 2,  storiesPerWeek: 0,  brands: 1,  platforms: 2, autoPublish: false, competitorAgent: false, trendsAgent: false, autoComments: false, autoProposalsPerWeek: 3,  videosPerWeek: 0,  requestsPerMonth: 2,        selfServiceActions: 10,       autopilot: false, inspirationAccess: true, carouselMaxPhotos: 3,  allowedPlatforms: ['instagram', 'facebook'],              tiktokAvailable: false },
  pro:     { postsPerMonth: Infinity, postsPerWeek: 4,  storiesPerWeek: 3,  brands: 1,  platforms: 2, autoPublish: true,  competitorAgent: false, trendsAgent: false, autoComments: false, autoProposalsPerWeek: 6,  videosPerWeek: 2,  requestsPerMonth: 10,       selfServiceActions: 50,       autopilot: false, inspirationAccess: true, carouselMaxPhotos: 8,  allowedPlatforms: ['instagram', 'facebook', 'tiktok'],    tiktokAvailable: true  },
  total:   { postsPerMonth: Infinity, postsPerWeek: 20, storiesPerWeek: 14, brands: 1,  platforms: 2, autoPublish: true,  competitorAgent: true,  trendsAgent: true,  autoComments: true,  autoProposalsPerWeek: 30, videosPerWeek: 10, requestsPerMonth: Infinity, selfServiceActions: Infinity, autopilot: true,  inspirationAccess: true, carouselMaxPhotos: 20, allowedPlatforms: ['instagram', 'facebook', 'tiktok'],    tiktokAvailable: true  },
};

/** UI-facing metadata per plan.
 *
 *  Three plans: starter / pro / total.
 *  The user-visible labels:
 *
 *     starter → "Esencial"
 *     pro     → "Crecimiento"
 *     total   → "Profesional"
 *
 *  Every plan ships with 1 connected social account; extras cost €15/mo
 *  (tracked on brands.purchased_extra_accounts — see lib/social-quota.ts).
 */
export const PLAN_META: Record<SubscriptionPlan, {
  label:                    string;
  /** Monthly price in EUR (used for MRR calculations, dashboards, etc.) */
  price:                    number;
  /** Annual price in EUR (monthly × 12 × 0.85 discount) */
  annualPrice:              number;
  extraPlatformPrice:       number;
  tagline:                  string;
  socialAccountsIncluded:   number;
}> = {
  starter: { label: 'Esencial',      price: 21,  annualPrice: 21,  extraPlatformPrice: 15, tagline: '2 posts de foto por semana · Generación con IA',            socialAccountsIncluded: 1 },
  pro:     { label: 'Crecimiento',   price: 63,  annualPrice: 60,  extraPlatformPrice: 15, tagline: '4 fotos + 2 vídeos por semana · Soporte prioritario',        socialAccountsIncluded: 1 },
  total:   { label: 'Profesional',   price: 133, annualPrice: 113, extraPlatformPrice: 15, tagline: 'Hasta 20 fotos + 10 vídeos por semana · 24h',                socialAccountsIncluded: 1 },
};

/** Add-on pricing. One extra connected social account = €15/mo each. */
export const SOCIAL_ACCOUNT_ADDON_PRICE_EUR = 15;

// ─── Content mode type ───────────────────────────────────────────────────────

export type ContentMode = 'auto' | 'request' | 'self-service';

// ─── Generated Assets ────────────────────────────────────────────────────────

export type AssetStatus = 'generated' | 'approved' | 'rejected' | 'published';

export interface GeneratedAsset {
  id:               string;
  brand_id:         string;
  post_id:          string;
  version:          number;
  asset_url:        string;
  asset_type:       'image' | 'video';
  storage_path:     string | null;
  prompt:           string | null;
  inspiration_id:   string | null;
  model:            string | null;
  parameters:       Record<string, unknown>;
  status:           AssetStatus;
  is_current:       boolean;
  approved_at:      string | null;
  approved_by:      string | null;
  rejection_reason: string | null;
  quality_score:    number | null;
  ai_analysis:      Record<string, unknown> | null;
  created_at:       string;
}

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

// ─── Proposal (worker validation queue) ──────────────────────────────────────

export type ProposalStatus =
  | 'pending_qc' | 'qc_rejected_image' | 'qc_rejected_caption'
  | 'failed' | 'converted_to_post' | 'rejected';

export interface Proposal {
  id:               string;
  brand_id:         string;
  status:           ProposalStatus;
  format:           'image' | 'reel' | 'carousel' | 'story';
  platform:         Platform;
  caption_draft:    string | null;
  image_url:        string | null;
  week_start:       string | null;
  retry_count:      number;
  is_urgent:        boolean;
  content_idea_id:  string | null;
  created_at:       string;
}

// ─── Weekly Planning Module ───────────────────────────────────────────────────

export type WeeklyPlanStatus =
  | 'generating'
  | 'ideas_ready'
  | 'sent_to_client'
  | 'client_reviewing'
  | 'client_approved'
  | 'producing'
  | 'calendar_ready'
  | 'completed'
  | 'auto_approved'
  | 'skipped_by_client'
  | 'expired';

export interface WeeklyPlan {
  id:                    string;
  brand_id:              string;
  parent_job_id:         string | null;
  week_start:            string;
  status:                WeeklyPlanStatus;
  sent_to_client_at:     string | null;
  client_first_action_at: string | null;
  client_approved_at:    string | null;
  auto_approved:         boolean;
  auto_approved_at:      string | null;
  reminder_2_sent_at:    string | null;
  reminder_4_sent_at:    string | null;
  reminder_6_sent_at:    string | null;
  claimed_by:            string | null;
  claimed_at:            string | null;
  skip_reason:           string | null;
  created_at:            string;
  updated_at:            string;
}

export type ContentIdeaFormat = 'image' | 'reel' | 'carousel' | 'story';

export type ContentIdeaStatus =
  | 'pending'
  | 'client_approved'
  | 'client_edited'
  | 'client_rejected'
  | 'client_requested_variation'
  | 'auto_approved'
  | 'auto_skipped'
  | 'in_production'
  | 'produced';

// ─── Sprint 10: Story / brand-material types ─────────────────────────────────

export type ContentKind         = 'post' | 'story';
export type StoryType           = 'schedule' | 'quote' | 'promo' | 'data' | 'custom' | 'photo';
export type BrandMaterialCategory = 'schedule' | 'promo' | 'data' | 'quote' | 'free';
export type StoryTemplateKind   = 'system' | 'custom';

export interface StoryTemplate {
  id:            string;
  kind:          StoryTemplateKind;
  brand_id:      string | null;
  name:          string;
  layout_config: Record<string, unknown>;
  preview_url:   string | null;
  created_at:    string;
}

export interface BrandMaterial {
  id:            string;
  brand_id:      string;
  category:      BrandMaterialCategory;
  content:       Record<string, unknown>;
  active:        boolean;
  valid_until:   string | null;
  display_order: number;
  created_at:    string;
  updated_at:    string;
}

export interface ContentIdea {
  id:                     string;
  week_id:                string;
  brand_id:               string;
  agent_output_id:        string | null;
  category_id:            string | null;
  position:               number;
  day_of_week:            number | null;
  format:                 ContentIdeaFormat;
  angle:                  string;
  hook:                   string | null;
  copy_draft:             string | null;
  hashtags:               string[] | null;
  suggested_asset_url:    string | null;
  suggested_asset_id:     string | null;
  client_edited_copy:     string | null;
  client_edited_hashtags: string[] | null;
  final_copy:             string | null;
  final_hashtags:         string[] | null;
  status:                 ContentIdeaStatus;
  proposal_id:            string | null;
  post_id:                string | null;
  // Sprint 10
  content_kind:           ContentKind;
  story_type:             StoryType | null;
  template_id:            string | null;
  rendered_image_url:     string | null;
  created_at:             string;
  updated_at:             string;
}

export type ClientFeedbackAction =
  | 'approve'
  | 'edit'
  | 'request_variation'
  | 'reject'
  | 'retouch_final';

export interface ClientFeedback {
  id:             string;
  idea_id:        string;
  brand_id:       string;
  action:         ClientFeedbackAction;
  previous_value: Record<string, unknown> | null;
  new_value:      Record<string, unknown> | null;
  comment:        string | null;
  created_at:     string;
}

// ─── Retouch requests (Sprint 7) ─────────────────────────────────────────────

export type RetouchType   = 'copy' | 'schedule' | 'freeform';
export type RetouchStatus = 'pending' | 'resolved' | 'rejected';

export interface RetouchRequest {
  id:                     string;
  post_id:                string;
  week_id:                string;
  brand_id:               string;
  requested_by_user_id:   string | null;
  retouch_type:           RetouchType;
  original_value:         Record<string, unknown> | null;
  requested_value:        Record<string, unknown> | null;
  client_comment:         string | null;
  status:                 RetouchStatus;
  resolved_at:            string | null;
  resolved_by_worker_id:  string | null;
  resolution_notes:       string | null;
  created_at:             string;
}

export interface ScheduleChange {
  id:                  string;
  post_id:             string;
  week_id:             string | null;
  brand_id:            string;
  changed_by_user_id:  string | null;
  changed_by_role:     'client' | 'worker';
  old_scheduled_at:    string | null;
  new_scheduled_at:    string;
  change_reason:       string | null;
  created_at:          string;
}
