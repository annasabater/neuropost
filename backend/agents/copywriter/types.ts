// ─────────────────────────────────────────────────────────────────────────────
// Postly — CopywriterAgent types
// ─────────────────────────────────────────────────────────────────────────────

import type { ImageAnalysis } from '../editor/types.js';

// ─── Input ────────────────────────────────────────────────────────────────────

/** Primary objective the post should achieve */
export type PostGoal = 'engagement' | 'awareness' | 'promotion' | 'community';

/** Social platforms to generate copy for */
export type Platform = 'instagram' | 'facebook';

export interface CopywriterInput {
  /**
   * Visual tags produced by EditorAgent.
   * Ground-truth of what's physically in the photo.
   */
  visualTags: string[];

  /**
   * Structural image analysis from EditorAgent (composition, subjects, etc.)
   * Used to tailor caption length and focus.
   */
  imageAnalysis: ImageAnalysis;

  /** What this post should accomplish */
  goal: PostGoal;

  /** Which platforms will publish this post */
  platforms: Platform[];

  /**
   * Optional extra context from the business owner.
   * E.g. "promotion for summer launch", "new flavour: mango chilli"
   */
  postContext?: string;

  /**
   * Product or offer being featured, if any.
   * E.g. { name: "Tarrina XL", price: "4,50 €" }
   */
  product?: {
    name: string;
    price?: string;
    description?: string;
  };
}

// ─── Output ───────────────────────────────────────────────────────────────────

/**
 * Platform-specific copy block.
 * Character limits are enforced in the prompt:
 * - Instagram caption: ≤ 2,200 chars (optimal 150–300)
 * - Facebook post:     ≤ 500 chars  (optimal 40–80)
 */
export interface PlatformCopy {
  /** Main post text, ready to publish */
  caption: string;
  /** Estimated character count */
  charCount: number;
}

/**
 * Tiered hashtag strategy.
 * Combining all three tiers gives a balanced reach:
 * branded (2–3) + niche (5–7) + broad (3–5) = ≤ 15 total for Instagram.
 * Facebook uses only branded + niche (3–5 total).
 */
export interface HashtagSet {
  /** Business-specific tags, e.g. #HeladeriaPolar */
  branded: string[];
  /** Sector + product-specific, e.g. #HeladoArtesanal */
  niche: string[];
  /** High-volume discovery tags, e.g. #Verano #Helado */
  broad: string[];
}

export interface CopywriterOutput {
  /** Copy per platform; only includes platforms requested in input */
  copies: Partial<Record<Platform, PlatformCopy>>;

  /** Hashtags ready to append to or include in captions */
  hashtags: HashtagSet;

  /**
   * Suggested call-to-action text (without emoji).
   * Caller decides whether to embed it in the caption or use it as a link CTA.
   */
  callToAction: string;

  /**
   * Accessibility alt-text for the image (≤ 125 chars).
   * Used when uploading to Meta Graph API.
   */
  altText: string;

  /**
   * Single-sentence summary of the copy strategy chosen.
   * Useful for human reviewers in the approval flow.
   */
  strategySummary: string;
}
