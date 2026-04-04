// ─────────────────────────────────────────────────────────────────────────────
// Postly — IdeasAgent types
// ─────────────────────────────────────────────────────────────────────────────

import type { PostGoal } from '../copywriter/types.js';

export type PostFormat = 'image' | 'reel' | 'carousel' | 'story';

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
  prompt: string;
  count:  number;   // 1-30
}

export interface IdeasOutput {
  ideas: IdeaItem[];
}
