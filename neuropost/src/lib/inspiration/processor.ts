// =============================================================================
// NEUROPOST — Inspiration queue processor
// Handles three item types end-to-end:
//   - single photo (source='telegram_photo', no media_group_id)
//   - carousel    (source='telegram_photo' with media_group_id, ≥2 jobs)
//   - video       (source='telegram_video')
//
// Flow per item: extract → dedup (pHash) → upload → vision → insert → notify
// =============================================================================

import { createAdminClient } from '@/lib/supabase';
import { extractTelegramPhoto } from './extractors/telegram-file';
import { extractTelegramVideo } from './extractors/telegram-video';
import { extractPinterestUrl } from './extractors/pinterest';
import { uploadToInspirationBucket } from './storage';
import { analyzeImage, analyzeCarousel, analyzeVideo } from './vision';
import { computeDhash, findNearDuplicate } from './phash';
import { sendTelegramMessage } from './telegram-api';
import type { QueueJob, ExtractedMedia } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

function uuidSlug(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function markJobs(
  supabase: DB,
  jobIds:  string[],
  patch:   Record<string, unknown>,
): Promise<void> {
  if (jobIds.length === 0) return;
  await supabase.from('inspiration_queue').update(patch).in('id', jobIds);
}

// ─── Single photo ───────────────────────────────────────────────────────────

async function processSinglePhoto(supabase: DB, job: QueueJob) {
  const payload = job.payload as { file_id: string };
  if (!payload?.file_id) throw new Error('Missing file_id');

  const media = await extractTelegramPhoto(payload.file_id);
  const file  = media.files[0];
  if (!file) throw new Error('No file extracted');

  // pHash dedup
  const hash = await computeDhash(file.buffer);
  const dup  = await findNearDuplicate(hash);
  if (dup) {
    await markJobs(supabase, [job.id], {
      status:       'done',
      result_item_id: dup.id,
      last_error:   `dup of ${dup.id} (d=${dup.distance})`,
      processed_at: new Date().toISOString(),
    });
    if (job.telegram_chat_id) {
      await sendTelegramMessage(
        job.telegram_chat_id,
        `⚠️ Ya tenías una foto muy parecida. No la añado de nuevo.`,
        job.telegram_message_id ? { reply_to_message_id: job.telegram_message_id } : {},
      );
    }
    return;
  }

  const storagePath = `telegram/${today()}/${uuidSlug()}.jpg`;
  const publicUrl   = await uploadToInspirationBucket(file.buffer, storagePath, file.mimeType);

  const analysis = await analyzeImage(file.buffer, file.mimeType);

  const { data: inserted, error } = await supabase
    .from('inspiration_bank')
    .insert({
      media_type:       'image',
      media_urls:       [publicUrl],
      thumbnail_url:    publicUrl,
      perceptual_hash:  hash,
      hidden_prompt:    analysis.hidden_prompt,
      category:         analysis.category,
      tags:             analysis.tags,
      dominant_colors:  analysis.dominant_colors,
      mood:             analysis.mood,
      source_platform:  media.sourcePlatform,
      telegram_user_id: job.telegram_user_id,
    })
    .select('id')
    .single();

  if (error || !inserted) throw new Error(`Insert failed: ${error?.message ?? 'unknown'}`);

  await markJobs(supabase, [job.id], {
    status: 'done', result_item_id: inserted.id, processed_at: new Date().toISOString(),
  });

  if (job.telegram_chat_id) {
    await sendTelegramMessage(
      job.telegram_chat_id,
      `✅ Añadido a ${analysis.category}\nTags: ${analysis.tags.join(', ') || '—'}`,
      job.telegram_message_id ? { reply_to_message_id: job.telegram_message_id } : {},
    );
  }
}

// ─── Carousel (jobs sharing a media_group_id) ───────────────────────────────

async function processCarousel(supabase: DB, jobs: QueueJob[]) {
  // Deterministic order: by telegram_message_id asc, then created_at
  jobs.sort((a, b) => {
    const aM = a.telegram_message_id ?? 0;
    const bM = b.telegram_message_id ?? 0;
    return aM - bM;
  });

  // Extract all
  const medias: ExtractedMedia[] = [];
  for (const j of jobs) {
    const payload = j.payload as { file_id: string };
    if (!payload?.file_id) continue;
    medias.push(await extractTelegramPhoto(payload.file_id));
  }
  if (medias.length === 0) throw new Error('Carousel: no files extracted');

  // pHash from the first slide (represents the carousel)
  const firstFile = medias[0].files[0];
  const hash = await computeDhash(firstFile.buffer);
  const dup  = await findNearDuplicate(hash);
  if (dup) {
    await markJobs(supabase, jobs.map(j => j.id), {
      status: 'done', result_item_id: dup.id,
      last_error: `dup of ${dup.id} (d=${dup.distance})`,
      processed_at: new Date().toISOString(),
    });
    if (jobs[0].telegram_chat_id) {
      await sendTelegramMessage(jobs[0].telegram_chat_id, '⚠️ Carrusel muy parecido a uno ya guardado.');
    }
    return;
  }

  // Upload all slides
  const urls: string[] = [];
  for (const m of medias) {
    const f  = m.files[0];
    const path = `telegram/${today()}/${uuidSlug()}.jpg`;
    urls.push(await uploadToInspirationBucket(f.buffer, path, f.mimeType));
  }

  const analysis = await analyzeCarousel(medias.map(m => ({
    buffer:   m.files[0].buffer,
    mimeType: m.files[0].mimeType,
  })));

  const { data: inserted, error } = await supabase
    .from('inspiration_bank')
    .insert({
      media_type:       'carousel',
      media_urls:       urls,
      thumbnail_url:    urls[0],
      perceptual_hash:  hash,
      hidden_prompt:    analysis.hidden_prompt,
      slide_prompts:    analysis.slide_prompts,
      category:         analysis.category,
      tags:             analysis.tags,
      dominant_colors:  analysis.dominant_colors,
      mood:             analysis.mood,
      source_platform:  'telegram_direct',
      telegram_user_id: jobs[0].telegram_user_id,
    })
    .select('id')
    .single();

  if (error || !inserted) throw new Error(`Insert failed: ${error?.message ?? 'unknown'}`);

  await markJobs(supabase, jobs.map(j => j.id), {
    status: 'done', result_item_id: inserted.id, processed_at: new Date().toISOString(),
  });

  if (jobs[0].telegram_chat_id) {
    await sendTelegramMessage(
      jobs[0].telegram_chat_id,
      `✅ Carrusel (${urls.length} slides) añadido a ${analysis.category}\nTags: ${analysis.tags.join(', ') || '—'}`,
    );
  }
}

// ─── Video ──────────────────────────────────────────────────────────────────

async function processVideo(supabase: DB, job: QueueJob) {
  const payload = job.payload as { file_id: string };
  if (!payload?.file_id) throw new Error('Missing file_id');

  const media = await extractTelegramVideo(payload.file_id);
  const [videoFile, ...frames] = media.files;
  if (!videoFile || frames.length === 0) throw new Error('Video extraction returned no frames');

  // pHash on the middle frame
  const midFrame = frames[Math.floor(frames.length / 2)];
  const hash = await computeDhash(midFrame.buffer);
  const dup  = await findNearDuplicate(hash);
  if (dup) {
    await markJobs(supabase, [job.id], {
      status: 'done', result_item_id: dup.id,
      last_error: `dup of ${dup.id}`,
      processed_at: new Date().toISOString(),
    });
    if (job.telegram_chat_id) {
      await sendTelegramMessage(
        job.telegram_chat_id, '⚠️ Vídeo parecido a uno ya guardado.',
        job.telegram_message_id ? { reply_to_message_id: job.telegram_message_id } : {},
      );
    }
    return;
  }

  // Upload video + frames
  const videoPath = `telegram/${today()}/${uuidSlug()}.mp4`;
  const videoUrl  = await uploadToInspirationBucket(videoFile.buffer, videoPath, 'video/mp4');

  const frameUrls: string[] = [];
  for (const f of frames) {
    const p = `telegram/${today()}/frames/${uuidSlug()}.jpg`;
    frameUrls.push(await uploadToInspirationBucket(f.buffer, p, 'image/jpeg'));
  }

  const analysis = await analyzeVideo(frames.map(f => ({ buffer: f.buffer, mimeType: f.mimeType })));

  const { data: inserted, error } = await supabase
    .from('inspiration_bank')
    .insert({
      media_type:         'video',
      media_urls:         [videoUrl],
      thumbnail_url:      frameUrls[0],      // first frame as poster
      video_frames_urls:  frameUrls,
      perceptual_hash:    hash,
      hidden_prompt:      analysis.hidden_prompt,
      scene_prompts:      analysis.scene_prompts,
      motion_description: analysis.motion_description,
      category:           analysis.category,
      tags:               analysis.tags,
      dominant_colors:    analysis.dominant_colors,
      mood:               analysis.mood,
      source_platform:    'telegram_direct',
      telegram_user_id:   job.telegram_user_id,
    })
    .select('id')
    .single();

  if (error || !inserted) throw new Error(`Insert failed: ${error?.message ?? 'unknown'}`);

  await markJobs(supabase, [job.id], {
    status: 'done', result_item_id: inserted.id, processed_at: new Date().toISOString(),
  });

  if (job.telegram_chat_id) {
    await sendTelegramMessage(
      job.telegram_chat_id,
      `✅ Vídeo añadido a ${analysis.category}\nTags: ${analysis.tags.join(', ') || '—'}`,
      job.telegram_message_id ? { reply_to_message_id: job.telegram_message_id } : {},
    );
  }
}

// ─── Pinterest URL ──────────────────────────────────────────────────────────

async function processPinterestUrl(supabase: DB, job: QueueJob) {
  const payload = job.payload as { url: string };
  if (!payload?.url) throw new Error('Missing url');

  const media = await extractPinterestUrl(payload.url);

  // Branch by media type. Both paths mirror the Telegram equivalents but set
  // source_platform='pinterest' and source_url=<pin URL>.
  if (media.mediaType === 'video') {
    const [videoFile, ...frames] = media.files;
    if (!videoFile || frames.length === 0) throw new Error('Pinterest video extraction returned no frames');

    // pHash on the middle frame
    const mid  = frames[Math.floor(frames.length / 2)];
    const hash = await computeDhash(mid.buffer);
    const dup  = await findNearDuplicate(hash);
    if (dup) {
      await markJobs(supabase, [job.id], {
        status: 'done', result_item_id: dup.id,
        last_error: `dup of ${dup.id}`,
        processed_at: new Date().toISOString(),
      });
      if (job.telegram_chat_id) {
        await sendTelegramMessage(job.telegram_chat_id,
          '⚠️ Este pin ya lo tenías o es muy parecido.',
          job.telegram_message_id ? { reply_to_message_id: job.telegram_message_id } : {});
      }
      return;
    }

    const videoPath = `pinterest/${today()}/${uuidSlug()}.mp4`;
    const videoUrl  = await uploadToInspirationBucket(videoFile.buffer, videoPath, 'video/mp4');
    const frameUrls: string[] = [];
    for (const f of frames) {
      const p = `pinterest/${today()}/frames/${uuidSlug()}.jpg`;
      frameUrls.push(await uploadToInspirationBucket(f.buffer, p, 'image/jpeg'));
    }

    const analysis = await analyzeVideo(frames.map(f => ({ buffer: f.buffer, mimeType: f.mimeType })));

    const { data: inserted, error } = await supabase
      .from('inspiration_bank')
      .insert({
        media_type:         'video',
        media_urls:         [videoUrl],
        thumbnail_url:      frameUrls[0],
        video_frames_urls:  frameUrls,
        perceptual_hash:    hash,
        hidden_prompt:      analysis.hidden_prompt,
        scene_prompts:      analysis.scene_prompts,
        motion_description: analysis.motion_description,
        category:           analysis.category,
        tags:               analysis.tags,
        dominant_colors:    analysis.dominant_colors,
        mood:               analysis.mood,
        source_platform:    'pinterest',
        source_url:         payload.url,
        telegram_user_id:   job.telegram_user_id,
      })
      .select('id')
      .single();
    if (error || !inserted) throw new Error(`Insert failed: ${error?.message ?? 'unknown'}`);

    await markJobs(supabase, [job.id], {
      status: 'done', result_item_id: inserted.id, processed_at: new Date().toISOString(),
    });

    if (job.telegram_chat_id) {
      await sendTelegramMessage(job.telegram_chat_id,
        `✅ Vídeo de Pinterest añadido a ${analysis.category}\nTags: ${analysis.tags.join(', ') || '—'}`,
        job.telegram_message_id ? { reply_to_message_id: job.telegram_message_id } : {});
    }
    return;
  }

  // Image pin
  const file = media.files[0];
  if (!file) throw new Error('Pinterest image extraction returned no file');

  const hash = await computeDhash(file.buffer);
  const dup  = await findNearDuplicate(hash);
  if (dup) {
    await markJobs(supabase, [job.id], {
      status: 'done', result_item_id: dup.id,
      last_error: `dup of ${dup.id} (d=${dup.distance})`,
      processed_at: new Date().toISOString(),
    });
    if (job.telegram_chat_id) {
      await sendTelegramMessage(job.telegram_chat_id,
        '⚠️ Ya tenías un pin muy parecido. No lo añado de nuevo.',
        job.telegram_message_id ? { reply_to_message_id: job.telegram_message_id } : {});
    }
    return;
  }

  const ext = file.mimeType === 'image/png'  ? 'png'
           : file.mimeType === 'image/webp' ? 'webp'
           : 'jpg';
  const storagePath = `pinterest/${today()}/${uuidSlug()}.${ext}`;
  const publicUrl   = await uploadToInspirationBucket(file.buffer, storagePath, file.mimeType);

  const analysis = await analyzeImage(file.buffer, file.mimeType);

  const { data: inserted, error } = await supabase
    .from('inspiration_bank')
    .insert({
      media_type:       'image',
      media_urls:       [publicUrl],
      thumbnail_url:    publicUrl,
      perceptual_hash:  hash,
      hidden_prompt:    analysis.hidden_prompt,
      category:         analysis.category,
      tags:             analysis.tags,
      dominant_colors:  analysis.dominant_colors,
      mood:             analysis.mood,
      source_platform:  'pinterest',
      source_url:       payload.url,
      telegram_user_id: job.telegram_user_id,
    })
    .select('id')
    .single();
  if (error || !inserted) throw new Error(`Insert failed: ${error?.message ?? 'unknown'}`);

  await markJobs(supabase, [job.id], {
    status: 'done', result_item_id: inserted.id, processed_at: new Date().toISOString(),
  });

  if (job.telegram_chat_id) {
    await sendTelegramMessage(job.telegram_chat_id,
      `✅ Pin añadido a ${analysis.category}\nTags: ${analysis.tags.join(', ') || '—'}`,
      job.telegram_message_id ? { reply_to_message_id: job.telegram_message_id } : {});
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Process a single job or a batch of sibling jobs (same media_group_id).
 * If jobs.length > 1, they are treated as a carousel.
 */
export async function processJobGroup(jobs: QueueJob[]): Promise<void> {
  const supabase = createAdminClient() as DB;
  if (jobs.length === 0) return;

  const ids = jobs.map(j => j.id);
  await markJobs(supabase, ids, { status: 'processing' });

  try {
    // Carousel: 2+ jobs sharing a media_group_id, all telegram_photo
    if (jobs.length > 1 && jobs.every(j => j.source === 'telegram_photo')) {
      await processCarousel(supabase, jobs);
      return;
    }

    // Singleton path
    const job = jobs[0];
    if (job.source === 'telegram_photo') {
      await processSinglePhoto(supabase, job);
    } else if (job.source === 'telegram_video') {
      await processVideo(supabase, job);
    } else if (job.source === 'pinterest_url') {
      await processPinterestUrl(supabase, job);
    } else {
      throw new Error(`Unsupported source: ${job.source}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[inspiration] group failed:', msg, 'jobs:', ids);
    await markJobs(supabase, ids, {
      status:       'failed',
      last_error:   msg,
      processed_at: new Date().toISOString(),
    });
    // Notify once (first chat)
    const first = jobs[0];
    if (first?.telegram_chat_id) {
      await sendTelegramMessage(
        first.telegram_chat_id,
        `❌ Error procesando: ${msg.slice(0, 200)}`,
        first.telegram_message_id ? { reply_to_message_id: first.telegram_message_id } : {},
      );
    }
  }
}

/** Kept for backwards compatibility — wraps the group processor. */
export async function processJob(job: QueueJob): Promise<void> {
  return processJobGroup([job]);
}
