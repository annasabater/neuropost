// ─────────────────────────────────────────────────────────────────────────────
//  CreativeExtractorAgent — types
//
//  The extractor turns a piece of viral/high-performing social content into
//  a reusable "creative recipe" (JSON). Recipes are stored in
//  public.biblioteca_creativa and later matched + regenerated for each brand.
// ─────────────────────────────────────────────────────────────────────────────

export type ExtractorPlatform = 'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'manual';

export interface ExtractorInput {
  platform:       ExtractorPlatform;
  /** Public URL or storage URL of the source image / first video frame. */
  imageUrl?:      string;
  /** Original caption text (if any). Helps Claude when no visual is given. */
  caption?:       string;
  /** Free-text description / manual annotation. Required if no imageUrl. */
  description?:   string;
  /** Optional engagement snapshot to bias quality_score. */
  metrics?: {
    views?:     number;
    likes?:     number;
    shares?:    number;
    saves?:     number;
    comments?:  number;
  };
  /** Source URL + account for traceability (stored in biblioteca_creativa). */
  sourceUrl?:     string;
  sourceAccount?: string;
}

// ── Recipe JSON — matches exactly the biblioteca_creativa.receta_completa
//    column. See prompt_1_extractor.md for the authoritative schema. ──────────

export type HookType =
  | 'question' | 'statement' | 'pattern_interrupt' | 'visual_shock'
  | 'number_stat' | 'transformation' | 'other';

export interface CreativeRecipe {
  type:              'image' | 'carousel' | 'video';
  platform:          'instagram' | 'tiktok' | 'facebook';

  creative_prompt:   string;

  hook: {
    type:                  HookType;
    text_or_description:   string;
    timing_seconds:        number;
    strength_1_10:         number;
  };

  description: string;

  visual_style: {
    aesthetic:                  string;
    lighting:                   string;
    color_palette:              string[];
    color_palette_description:  string;
    composition:                string;
    camera_style:               string;
    aspect_ratio:               '9:16' | '1:1' | '4:5' | '16:9';
  };

  content_structure: {
    format_breakdown:       string;
    narrative_flow:         string;
    pacing:                 'slow' | 'medium' | 'fast' | 'variable';
    scene_changes_per_10s:  number;
    key_elements:           string[];
    duration_seconds:       number;
    slide_count:            number;
  };

  subject: {
    main_subject:          string;
    subject_demographics:  string | null;
    secondary_elements:    string[];
    environment:           string;
    props:                 string[];
  };

  audio_style: {
    type:                 'voiceover' | 'trending_audio' | 'original_music' | 'ambient' | 'silent' | 'dialogue' | 'none';
    description:          string;
    energy:               'low' | 'medium' | 'high';
    uses_trending_sound:  boolean;
  };

  text_overlay: {
    present:  boolean;
    style:    string | null;
    examples: string[];
    role:     'primary_message' | 'caption_support' | 'decoration' | 'call_to_action' | null;
  };

  caption_analysis: {
    hook_line:        string | null;
    length_category:  'micro' | 'short' | 'medium' | 'long' | null;
    cta_type:         'save' | 'share' | 'comment' | 'dm' | 'follow' | 'visit_link' | 'none' | null;
    tone:             'casual' | 'professional' | 'provocative' | 'educational' | 'humorous' | 'emotional' | null;
    uses_questions:   boolean;
    uses_emojis:      boolean;
  };

  objective:        'engagement' | 'conversion' | 'education' | 'branding' | 'community' | 'awareness';
  target_emotion:   'inspiration' | 'curiosity' | 'humor' | 'aspiration' | 'nostalgia' | 'urgency' | 'empathy' | 'shock';
  target_audience:  string;

  industry_vertical: string;
  sub_niche:         string | null;

  reusability: {
    is_generic_template:         boolean;
    localization_difficulty:     'easy' | 'medium' | 'hard';
    requires_specific_props:     boolean;
    requires_specific_location:  boolean;
    requires_talent_on_camera:   boolean;
    notes:                       string;
  };

  tags: string[];

  quality_score:      number;   // 1..10
  quality_reasoning:  string;

  virality_signals: {
    pattern_interrupt:   boolean;
    emotional_payoff:    boolean;
    share_trigger:       string;
    save_trigger:        string;
    comment_trigger:     string;
  };
}

export interface ExtractorOutput {
  /** The structured recipe to persist. */
  recipe: CreativeRecipe;

  /**
   * Short text used for embedding generation (concatenation of
   * creative_prompt + tags + industry + hook). The handler passes this
   * to generateEmbedding() and stores the result in
   * biblioteca_creativa.embedding.
   */
  embeddingText: string;
}
