export type PostRevision = {
  id: string;
  post_id: string;
  brand_id: string;
  revision_index: number;
  prompt: string | null;
  negative_prompt?: string | null;
  model: string | null;
  strength: number | null;
  guidance: number | null;
  num_outputs?: number | null;
  image_url: string | null;
  cost_usd: number | null;
  duration_seconds: number | null;
  triggered_by?: 'agent' | 'worker' | 'client' | null;
  worker_id?: string | null;
  error_message?: string | null;
  brief_snapshot?: Record<string, unknown> | null;
  created_at: string;
};

export type BriefDraft = {
  prompt: string;
  negative_prompt: string;
  edit_strength: number;
  guidance: number;
  model: 'flux-pro' | 'flux-kontext-pro' | 'nanobanana';
  num_outputs: number;
  primary_image_url: string;
};

export type CockpitPost = {
  id: string;
  brand_id: string;
  image_url?: string | null;
  edited_image_url?: string | null;
  caption?: string | null;
  hashtags?: string[] | null;
  format?: string | null;
  status: string;
  ai_explanation?: string | null;
  agent_brief?: Record<string, unknown> | null;
  created_at: string;
};

export type Inspiration = { id: string; thumbnail_url: string };
