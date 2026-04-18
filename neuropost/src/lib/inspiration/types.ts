// =============================================================================
// NEUROPOST — Inspiration Bank types
// Mirrors the SQL schema in supabase/migrations/20260418_inspiration_telegram.sql
// =============================================================================

import type { SocialSector } from '@/types';

export type MediaType = 'image' | 'carousel' | 'video';

export type IngestionStatus = 'pending' | 'processing' | 'done' | 'failed';

export type IngestionSource =
  | 'telegram_photo'
  | 'telegram_video'
  | 'telegram_document'
  | 'telegram_media_group'
  | 'instagram_url'
  | 'tiktok_url'
  | 'pinterest_url'
  | 'generic_url';

/** Category is a SocialSector value or 'otros'. Stored as free text. */
export type InspirationCategory = SocialSector | 'otros';

// ─── Row types (match DB columns) ───────────────────────────────────────────

export interface InspirationBankItem {
  id:                  string;
  media_type:          MediaType;
  media_urls:          string[];
  thumbnail_url:       string | null;
  video_frames_urls:   string[];
  perceptual_hash:     string | null;

  hidden_prompt:       string;
  slide_prompts:       string[];
  scene_prompts:       string[];
  motion_description:  string | null;

  category:            string;        // InspirationCategory, but stored as free text
  tags:                string[];
  dominant_colors:     string[];
  mood:                string | null;

  source_platform:     string | null;
  source_url:          string | null;
  ingested_by:         string | null;
  created_at:          string;
}

/** Client-facing subset (no hidden prompts). */
export type InspirationBankPublic = Omit<
  InspirationBankItem,
  'hidden_prompt' | 'slide_prompts' | 'scene_prompts'
>;

export interface QueueJob {
  id:                   string;
  source:               IngestionSource;
  payload:              Record<string, unknown>;
  telegram_chat_id:     number | null;
  telegram_message_id:  number | null;
  media_group_id:       string | null;
  status:               IngestionStatus;
  attempts:             number;
  last_error:           string | null;
  result_item_id:       string | null;
  created_at:           string;
  processed_at:         string | null;
}

// ─── Extraction types (pre-DB) ──────────────────────────────────────────────

/** A single media file ready to be uploaded + analysed. */
export interface ExtractedFile {
  buffer:    Buffer;
  mimeType:  string;
  filename:  string;
}

/** Output of an extractor (Telegram file, URL, etc.). */
export interface ExtractedMedia {
  mediaType:      MediaType;
  files:          ExtractedFile[];
  sourcePlatform: string | null;
  sourceUrl:      string | null;
}

// ─── Vision analysis output ─────────────────────────────────────────────────

export interface VisionAnalysisImage {
  hidden_prompt:    string;
  category:         InspirationCategory;
  tags:             string[];
  dominant_colors:  string[];
  mood:             string;
}

export interface VisionAnalysisCarousel extends VisionAnalysisImage {
  slide_prompts:    string[];
}

export interface VisionAnalysisVideo extends VisionAnalysisImage {
  scene_prompts:       string[];
  motion_description:  string;
}

export type VisionAnalysis =
  | ({ type: 'image' } & VisionAnalysisImage)
  | ({ type: 'carousel' } & VisionAnalysisCarousel)
  | ({ type: 'video' } & VisionAnalysisVideo);
