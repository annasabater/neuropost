// =============================================================================
// NEUROPOST — Inspiration queue processor
// Consumes a QueueJob → extracts media → uploads → analyses → inserts into
// inspiration_bank → notifies the Telegram chat.
// Phase 3: only 'telegram_photo' source. Others throw 'not_implemented'.
// =============================================================================

import { createAdminClient } from '@/lib/supabase';
import { extractTelegramPhoto } from './extractors/telegram-file';
import { uploadToInspirationBucket } from './storage';
import { analyzeImage } from './vision';
import { sendTelegramMessage } from './telegram-api';
import type { QueueJob } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

function uuidSlug(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

async function markJob(
  supabase: DB,
  jobId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await supabase.from('inspiration_queue').update(patch).eq('id', jobId);
}

/**
 * Process a single queue job end-to-end.
 * Phase 3: handles `telegram_photo` only.
 */
export async function processJob(job: QueueJob): Promise<void> {
  const supabase = createAdminClient() as DB;

  // 1. Mark as processing (idempotent if the cron picker already did it)
  await markJob(supabase, job.id, { status: 'processing' });

  try {
    // 2. Extract
    if (job.source !== 'telegram_photo') {
      throw new Error(`Source "${job.source}" is not implemented in Phase 3`);
    }

    const payload = job.payload as { file_id: string; caption?: string };
    if (!payload?.file_id) {
      throw new Error('Missing file_id in payload');
    }

    const media = await extractTelegramPhoto(payload.file_id);
    const file  = media.files[0];
    if (!file) throw new Error('Extractor returned no files');

    // 3. Upload to Storage
    const storagePath = `telegram/${new Date().toISOString().slice(0, 10)}/${uuidSlug()}.jpg`;
    const publicUrl   = await uploadToInspirationBucket(file.buffer, storagePath, file.mimeType);

    // 4. Analyse with Claude Vision
    const analysis = await analyzeImage(file.buffer, file.mimeType);

    // 5. Insert into inspiration_bank
    const { data: inserted, error: insertErr } = await supabase
      .from('inspiration_bank')
      .insert({
        media_type:      'image',
        media_urls:      [publicUrl],
        thumbnail_url:   publicUrl,
        hidden_prompt:   analysis.hidden_prompt,
        category:        analysis.category,
        tags:            analysis.tags,
        dominant_colors: analysis.dominant_colors,
        mood:            analysis.mood,
        source_platform: media.sourcePlatform,
        source_url:      media.sourceUrl,
      })
      .select('id')
      .single();

    if (insertErr || !inserted) {
      throw new Error(`Insert inspiration_bank failed: ${insertErr?.message ?? 'unknown'}`);
    }

    // 6. Mark done + link result
    await markJob(supabase, job.id, {
      status:         'done',
      result_item_id: inserted.id,
      processed_at:   new Date().toISOString(),
    });

    // 7. Notify Telegram
    if (job.telegram_chat_id) {
      const tagStr = analysis.tags.length > 0 ? analysis.tags.join(', ') : '—';
      await sendTelegramMessage(
        job.telegram_chat_id,
        `✅ Añadido a ${analysis.category}\nTags: ${tagStr}`,
        job.telegram_message_id
          ? { reply_to_message_id: job.telegram_message_id }
          : {},
      );
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[inspiration] job ${job.id} failed:`, msg);

    await markJob(supabase, job.id, {
      status:       'failed',
      attempts:     (job.attempts ?? 0) + 1,
      last_error:   msg,
      processed_at: new Date().toISOString(),
    });

    if (job.telegram_chat_id) {
      await sendTelegramMessage(
        job.telegram_chat_id,
        `❌ Error procesando: ${msg.slice(0, 200)}`,
        job.telegram_message_id
          ? { reply_to_message_id: job.telegram_message_id }
          : {},
      );
    }
  }
}
