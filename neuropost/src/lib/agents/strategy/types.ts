// =============================================================================
// Strategy agent — shared types
// =============================================================================
// Shapes returned by the LLM for taxonomy + ideas. Kept in one place so the
// JSON schema in the prompt and the TS types stay in sync.

export type PostFormat = 'foto' | 'carrusel' | 'reel' | 'story' | 'video';
export type Priority   = 'alta' | 'media' | 'baja';

/** A single leaf in the content tree (level 1 or level 2). */
export interface TaxonomyCategory {
  key:                 string;          // 'workouts' or 'workouts/full_body'
  name:                string;
  description:         string;
  weight_initial:      number;          // 0.0 – 1.0, normalized per level
  recommended_formats: PostFormat[];
  subcategories?:      TaxonomyCategory[];  // only on level-1 nodes
}

/** Top-level result of strategy:build_taxonomy */
export interface BuildTaxonomyOutput {
  sector:     string;
  categories: TaxonomyCategory[];
  rationale:  string;               // one-paragraph summary of why this mix
}

/** A single idea produced by strategy:generate_ideas */
export interface ContentIdea {
  title:         string;
  category_key:  string;            // points at a content_categories.category_key
  format:        PostFormat;
  priority:      Priority;
  rationale:     string;            // "Full body has 2.3x engagement…"
  caption_angle: string;            // short hook for the copywriter
  asset_hint:    string;            // "grabar rutina en zona funcional"
}

export interface GenerateIdeasOutput {
  ideas: ContentIdea[];
}

/** Result of strategy:plan_week — mirrors the shape stored as agent_outputs */
export interface PlanWeekOutput {
  ideas:      ContentIdea[];
  sub_jobs_queued: number;          // how many content:* jobs were fanned out
}
