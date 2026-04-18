// =============================================================================
// NEUROPOST — Inspiration bucket upload helper
// Uses createAdminClient() because the bot writes without a user session.
// =============================================================================

import { createAdminClient } from '@/lib/supabase';

const BUCKET = 'inspiration';

/**
 * Uploads a file to the `inspiration` Supabase Storage bucket and returns its
 * public URL. Throws on failure.
 */
export async function uploadToInspirationBucket(
  buffer:   Buffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filename, buffer, {
      contentType: mimeType,
      upsert:      false,
    });

  if (uploadError) {
    throw new Error(`Inspiration upload failed: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  return data.publicUrl as string;
}
