// ─────────────────────────────────────────────────────────────────────────────
// NeuroPost — posts row → NormalizedPost
//
// Builds the `NormalizedPost` shape the platform providers expect from a raw
// `posts` row (plus optional per-publication overrides). Used by the publish
// route and the publish-scheduled cron.
// ─────────────────────────────────────────────────────────────────────────────

import type { MediaAsset, NormalizedPost, PostFormat } from '@/lib/platforms';

// The legacy posts.format values map onto our canonical PostFormat set.
// 'image' was the historical default — treat it as 'foto'.
function mapFormat(raw: string | null | undefined): PostFormat {
  switch ((raw ?? 'foto').toLowerCase()) {
    case 'reel':                   return 'reel';
    case 'reels':                  return 'reel';
    case 'video':                  return 'video';
    case 'videos':                 return 'video';
    case 'carousel':               return 'carousel';
    case 'carrusel':               return 'carousel';
    case 'story':                  return 'story';
    case 'stories':                return 'story';
    case 'image':
    case 'images':
    case 'foto':
    case 'photo':
    default:                       return 'foto';
  }
}

function detectAssetType(url: string): 'image' | 'video' {
  return /\.(mp4|mov|webm|avi|m4v)(\?|$)/i.test(url) ? 'video' : 'image';
}

// Raw posts row shape — typed loosely because we only read a handful of
// fields. The DB client returns `any` and we cast here.
interface PostRowFragment {
  id:               string;
  caption:          string | null;
  hashtags:         string[] | null;
  format:           string | null;
  image_url:        string | null;
  edited_image_url: string | null;
  generated_images: string[] | null;
}

interface Overrides {
  caption?:  string;
  hashtags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Turn a posts row into a NormalizedPost ready for a provider.
 *
 * - Prefers `edited_image_url` → `image_url` → first of `generated_images`
 *   for the primary asset.
 * - `format='carousel'` uses `generated_images` (if present) as the full
 *   set of assets, falling back to just the primary.
 * - `overrides.caption` / `.hashtags` let the caller (publications flow)
 *   pass platform-adapted text without re-writing the posts table.
 */
export function normalizePostRow(
  row:        PostRowFragment,
  overrides:  Overrides = {},
): NormalizedPost {
  const format    = mapFormat(row.format);
  const caption   = overrides.caption  ?? row.caption ?? '';
  const hashtags  = overrides.hashtags ?? row.hashtags ?? [];

  const primaryUrl = row.edited_image_url
                  ?? row.image_url
                  ?? (row.generated_images ?? [])[0]
                  ?? null;

  const assets: MediaAsset[] = [];

  if (format === 'carousel' && Array.isArray(row.generated_images) && row.generated_images.length > 0) {
    for (const url of row.generated_images) {
      if (url) assets.push({ url, type: detectAssetType(url) });
    }
  } else if (primaryUrl) {
    assets.push({ url: primaryUrl, type: detectAssetType(primaryUrl) });
  }

  return {
    postId:   row.id,
    format,
    caption,
    hashtags,
    assets,
    metadata: overrides.metadata,
  };
}

/** Minimum column set you need to `SELECT` to call normalizePostRow. */
export const POST_NORMALIZE_COLUMNS =
  'id, caption, hashtags, format, image_url, edited_image_url, generated_images' as const;
