// =============================================================================
// NEUROPOST — Telegram file extractor
// Takes a file_id from a Telegram message and returns a single ExtractedMedia.
// Phase 3: only images. Video/carousel/media_group come in Phase 5.
// =============================================================================

import { getTelegramFile } from '../telegram-api';
import type { ExtractedMedia } from '../types';

export async function extractTelegramPhoto(
  fileId: string,
): Promise<ExtractedMedia> {
  const buffer = await getTelegramFile(fileId);

  return {
    mediaType:      'image',
    sourcePlatform: 'telegram_direct',
    sourceUrl:      null,
    files: [{
      buffer,
      mimeType: 'image/jpeg',
      filename: `telegram-${fileId}.jpg`,
    }],
  };
}
