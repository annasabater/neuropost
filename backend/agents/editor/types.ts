// ─────────────────────────────────────────────────────────────────────────────
// Postly — EditorAgent types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How much editing the agent should perform:
 * - `0` — Analyse only. Validate suitability, no parameter output.
 * - `1` — Light enhancement. Returns numeric parameters for brightness,
 *         contrast, saturation, warmth, sharpness, vignette.
 * - `2` — Full professional edit. Parameters + natural-language narrative
 *         explaining the editing strategy.
 */
export type EditingLevel = 0 | 1 | 2;

// ─── Input ────────────────────────────────────────────────────────────────────

export interface EditorInput {
  /** Raw base64 string (no data-URI prefix) OR a public URL */
  image: string;
  imageType: 'base64' | 'url';
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  editingLevel: EditingLevel;
  /** Optional note from the uploader about the photo content */
  photoContext?: string;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface CropSuggestion {
  /** Recommended aspect ratio for the final post */
  aspectRatio: '1:1' | '4:5' | '16:9';
  /** Normalised (0–1) point that should be the crop centre */
  focusPoint: { x: number; y: number };
}

export interface ImageAnalysis {
  /** Whether the image is appropriate for public social media posting */
  isSuitable: boolean;
  /** Explanation when isSuitable is false */
  suitabilityReason: string | null;
  /** Top 3 dominant hex colours */
  dominantColors: string[];
  composition: 'portrait' | 'landscape' | 'square' | 'unknown';
  /** Key visual elements detected */
  mainSubjects: string[];
  /** Overall technical quality 0–10 */
  qualityScore: number;
  /** List of detected technical problems, e.g. "blurry", "overexposed" */
  qualityIssues: string[];
  lightingCondition: 'natural' | 'artificial' | 'mixed' | 'dark' | 'overexposed';
  /** Crop recommendation; null if image is already well-composed */
  suggestedCrop: CropSuggestion | null;
}

/**
 * Numeric editing parameters compatible with Sharp / Jimp transforms.
 * All values are normalised to intuitive ranges centred on 0.
 */
export interface EditingParameters {
  /** Exposure adjustment  −100 (darker) → 100 (brighter) */
  brightness: number;
  /** Contrast adjustment  −100 (flat) → 100 (punchy) */
  contrast: number;
  /** Colour vibrancy     −100 (greyscale) → 100 (vivid) */
  saturation: number;
  /** Edge sharpening      0 (off) → 100 (max) */
  sharpness: number;
  /** Colour temperature  −100 (cool/blue) → 100 (warm/amber) */
  warmth: number;
  /** Corner darkening vignette  0 (off) → 100 (max) */
  vignette: number;
  /** Optional named filter preset, e.g. "warm_golden", "cool_minimal" */
  filter: string | null;
}

export interface EditorOutput {
  /** Always present regardless of editing level */
  analysis: ImageAnalysis;
  /** Populated for levels 1 and 2; null for level 0 */
  editingParameters: EditingParameters | null;
  /** Human-readable editing rationale — level 2 only */
  editingNarrative: string | null;
  /**
   * Visual descriptors for the image.
   * Passed downstream to CopywriterAgent so the caption reflects
   * what's actually in the photo.
   */
  visualTags: string[];
}
