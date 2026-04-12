// =============================================================================
// content:materialize_post
// =============================================================================
// Bridges agent_outputs → posts table. After strategy:plan_week fans out
// content:generate_caption + content:generate_image sub-jobs, this handler
// collects their outputs and creates the actual posts row.
//
// It can be:
//   a) Emitted as a sub-job by plan_week after caption+image are done
//   b) Triggered manually from the UI after reviewing agent outputs
//   c) Triggered by a future "auto-materialize" cron when sub-jobs complete
//
// Input shape:
//   {
//     caption_job_id:   string,   // job that produced the caption output
//     image_job_id?:    string,   // job that produced the image output (optional)
//     category_key?:    string,   // from the strategy idea
//     format?:          string,   // 'image' | 'carousel' | 'reel' (default 'image')
//     platform?:        string[], // default ['instagram']
//     status?:          string,   // 'pending' | 'draft' (default 'pending')
//   }
//
// Output: the post row with its id, ready for approval/publish.

import { createAdminClient } from '@/lib/supabase';
import { syncPostIntoFeedQueue } from '@/lib/feedQueue';
import { registerHandler } from '../registry';
import type { AgentHandler, AgentJob, HandlerResult } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

interface MaterializeInput {
  caption_job_id:  string;
  image_job_id?:   string;
  category_key?:   string;
  format?:         string;
  platform?:       string[];
  status?:         string;
}

/**
 * Extract the best caption from a copywriter agent_output payload.
 * CopywriterOutput shape: { copies: { instagram: { caption } }, hashtags: { branded, niche, broad } }
 */
function extractCaption(payload: Record<string, unknown>): { caption: string; hashtags: string[] } {
  const copies = payload.copies as Record<string, { caption?: string }> | undefined;
  let caption = '';
  if (copies) {
    caption = copies.instagram?.caption ?? copies.facebook?.caption ?? Object.values(copies)[0]?.caption ?? '';
  }
  // Fallback: some outputs have caption directly on the payload (e.g. from direct copywriter).
  if (!caption && typeof payload.caption === 'string') {
    caption = payload.caption;
  }

  const hashtags: string[] = [];
  const hs = payload.hashtags as { branded?: string[]; niche?: string[]; broad?: string[] } | undefined;
  if (hs) {
    hashtags.push(...(hs.branded ?? []), ...(hs.niche ?? []), ...(hs.broad ?? []));
  }

  return { caption, hashtags };
}

/**
 * Extract the image URL from an image-generate agent_output payload.
 * ImageGenerateOutput shape: { imageUrl: string, ... }
 */
function extractImageUrl(payload: Record<string, unknown>): string | null {
  if (typeof payload.imageUrl === 'string') return payload.imageUrl;
  if (typeof payload.editedImageUrl === 'string') return payload.editedImageUrl;
  return null;
}

const materializeHandler: AgentHandler = async (job: AgentJob): Promise<HandlerResult> => {
  if (!job.brand_id) return { type: 'fail', error: 'brand_id is required' };

  const input = job.input as unknown as MaterializeInput;
  if (!input.caption_job_id) {
    return { type: 'fail', error: 'caption_job_id is required' };
  }

  try {
    const db = createAdminClient() as DB;

    // 1. Read the caption output.
    const { data: captionOutputs } = await db
      .from('agent_outputs')
      .select('payload')
      .eq('job_id', input.caption_job_id)
      .in('kind', ['caption', 'strategy'])
      .order('created_at', { ascending: false })
      .limit(1);

    const captionPayload = ((captionOutputs ?? []) as Array<{ payload: Record<string, unknown> }>)[0]?.payload;
    if (!captionPayload) {
      return { type: 'fail', error: `No caption output found for job ${input.caption_job_id}` };
    }
    const { caption, hashtags } = extractCaption(captionPayload);

    // 2. Read the image output (optional).
    let imageUrl: string | null = null;
    if (input.image_job_id) {
      const { data: imageOutputs } = await db
        .from('agent_outputs')
        .select('payload')
        .eq('job_id', input.image_job_id)
        .in('kind', ['image', 'video'])
        .order('created_at', { ascending: false })
        .limit(1);

      const imagePayload = ((imageOutputs ?? []) as Array<{ payload: Record<string, unknown> }>)[0]?.payload;
      if (imagePayload) {
        imageUrl = extractImageUrl(imagePayload);
      }
    }

    // 3. Create the post row.
    const postStatus = input.status ?? 'pending';
    const postFormat = input.format ?? 'image';
    const platform   = input.platform ?? ['instagram'];

    const { data: post, error: insertErr } = await db
      .from('posts')
      .insert({
        brand_id:               job.brand_id,
        caption,
        hashtags,
        image_url:              imageUrl,
        format:                 postFormat,
        platform,
        status:                 postStatus,
        strategy_category_key:  input.category_key ?? null,
        created_by:             'agent',
      })
      .select()
      .single();
    if (insertErr) throw new Error(`insert post: ${insertErr.message}`);

    // 4. Sync into feed queue if applicable.
    try {
      await syncPostIntoFeedQueue(db, post);
    } catch { /* non-blocking — feed queue sync is best-effort */ }

    return {
      type: 'ok',
      outputs: [{
        kind:    'post',
        payload: {
          post_id:      post.id,
          caption:      caption.slice(0, 120),
          image_url:    imageUrl,
          format:       postFormat,
          status:       postStatus,
          category_key: input.category_key,
        } as unknown as Record<string, unknown>,
        model: 'materialize',
      }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { type: 'fail', error: msg };
  }
};

export function registerMaterializeHandler(): void {
  registerHandler({ agent_type: 'content', action: 'materialize_post' }, materializeHandler);
}
