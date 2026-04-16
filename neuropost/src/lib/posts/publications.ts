// ─────────────────────────────────────────────────────────────────────────────
// NeuroPost — post_publications DAL + publish orchestration
//
// Everything that reads/writes the post_publications table goes through
// this module, so the REST routes and the publish-scheduled cron share one
// source of truth.
//
// Two entry points for callers:
//   - requestPublications(postId, requests)  — schedule or publish now
//   - claimAndRun(publicationId)              — called by the cron for due rows
// ─────────────────────────────────────────────────────────────────────────────

import { createAdminClient } from '@/lib/supabase';
import {
  getProvider,
  getConnection,
  ProviderError,
  type Platform,
  type PublishResult,
} from '@/lib/platforms';
import { normalizePostRow, POST_NORMALIZE_COLUMNS } from './normalize';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export type PublicationStatus =
  | 'pending'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'cancelled';

export interface PublicationRow {
  id:                string;
  post_id:           string;
  platform:          Platform;
  caption:           string | null;
  hashtags:          string[];
  scheduled_at:      string | null;
  published_at:      string | null;
  platform_post_id:  string | null;
  platform_post_url: string | null;
  status:            PublicationStatus;
  error_message:     string | null;
  error_count:       number;
  last_attempt_at:   string | null;
  metadata:          Record<string, unknown>;
  created_at:        string;
  updated_at:        string;
}

export interface PublicationRequest {
  platform:      Platform;
  /** Platform-adapted caption. If omitted, falls back to posts.caption. */
  caption?:      string;
  /** Platform-adapted hashtags. If omitted, falls back to posts.hashtags. */
  hashtags?:     string[];
  /** null / undefined → publish immediately. Future date → schedule. */
  scheduledAt?:  Date | null;
  /** Privacy level, targeting, etc. */
  metadata?:     Record<string, unknown>;
}

export type PublicationMode =
  | 'published'       // immediate publish succeeded
  | 'scheduled'       // stored as scheduled, cron will run later
  | 'skipped'         // platform not connected — awaiting user action
  | 'unsupported'     // format not supported on this platform
  | 'failed';         // tried but provider rejected

export interface PublicationOutcome {
  platform:       Platform;
  mode:           PublicationMode;
  publication:    PublicationRow;
  publishResult?: PublishResult;
  error?:         string;
  errorCode?:     string;
}

// ─────────────────────────────────────────────────────────────────────────
// Public API — callers
// ─────────────────────────────────────────────────────────────────────────

/**
 * List every publication row for a given post.
 */
export async function listPublications(postId: string): Promise<PublicationRow[]> {
  const db = createAdminClient() as DB;
  const { data, error } = await db
    .from('post_publications')
    .select('*')
    .eq('post_id', postId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as PublicationRow[];
}

/**
 * Create or update publications for a post and, for any request without
 * `scheduledAt`, immediately publish via the provider. Each platform's
 * outcome is isolated — a failure in one never aborts the others (that's
 * the "option A" decision from the refactor contract).
 */
export async function requestPublications(
  postId:   string,
  requests: PublicationRequest[],
): Promise<PublicationOutcome[]> {
  if (requests.length === 0) return [];

  const db = createAdminClient() as DB;

  // Load post + brand in one round-trip.
  const { data: post, error: postErr } = await db
    .from('posts')
    .select(`${POST_NORMALIZE_COLUMNS}, brand_id, status`)
    .eq('id', postId)
    .single();
  if (postErr || !post) throw new Error(`Post ${postId} not found`);

  const outcomes: PublicationOutcome[] = [];

  // Process each platform independently — failures are per-row, not global.
  for (const req of requests) {
    try {
      outcomes.push(await processOne(post as PostRecord, req));
    } catch (err) {
      // Something unexpected blew up during persistence/normalization —
      // don't let it kill the other platforms.
      const msg = err instanceof Error ? err.message : String(err);
      const pub = await upsertPublication(postId, {
        ...req,
        // Store as failed so the UI can surface the error.
        metadata: { ...(req.metadata ?? {}), unexpected_error: msg },
      });
      await updatePublicationStatus(pub.id, 'failed', { error: msg, code: 'unexpected' });
      outcomes.push({
        platform:    req.platform,
        mode:        'failed',
        publication: { ...pub, status: 'failed', error_message: msg },
        error:       msg,
        errorCode:   'unexpected',
      });
    }
  }

  // After running all requests, keep the overall posts.status roughly in
  // sync so the UI of the old single-platform world still works:
  //   - if at least one publication is published → posts.status = 'published'
  //   - else if at least one is scheduled       → posts.status = 'scheduled'
  //   - else leave it alone
  await maybeUpdatePostAggregateStatus(db, postId);

  return outcomes;
}

interface PostRecord {
  id:               string;
  brand_id:         string;
  caption:          string | null;
  hashtags:         string[] | null;
  format:           string | null;
  image_url:        string | null;
  edited_image_url: string | null;
  generated_images: string[] | null;
  status:           string;
}

async function processOne(
  post: PostRecord,
  req:  PublicationRequest,
): Promise<PublicationOutcome> {
  const provider   = getProvider(req.platform);
  const normalized = normalizePostRow(post, {
    caption:  req.caption,
    hashtags: req.hashtags,
    metadata: req.metadata,
  });

  // 1. Format validation — cheap, before we touch the DB.
  const canPublish = provider.canPublish(normalized);
  if (!canPublish.ok) {
    const pub = await upsertPublication(post.id, req);
    await updatePublicationStatus(pub.id, 'failed', { error: canPublish.reason, code: 'unsupported_format' });
    return {
      platform: req.platform,
      mode:     'unsupported',
      publication: { ...pub, status: 'failed', error_message: canPublish.reason },
      error:    canPublish.reason,
      errorCode:'unsupported_format',
    };
  }

  // 2. Connection check — if the brand hasn't connected this platform, we
  //    still create a publication row in 'pending' state so the UI can
  //    show "content ready — connect TikTok to publish" (per the product
  //    decision). The cron ignores 'pending' rows (it only picks
  //    'scheduled' ones), and a later re-publish call will pick up the
  //    now-present connection.
  const connection = await getConnection(post.brand_id, req.platform);
  if (!connection) {
    const pub = await upsertPublication(post.id, {
      ...req,
      metadata: { ...(req.metadata ?? {}), awaiting_connection: true },
    });
    await updatePublicationStatus(pub.id, 'pending', { error: 'Platform not connected', code: 'not_connected' });
    return {
      platform: req.platform,
      mode:     'skipped',
      publication: { ...pub, status: 'pending', error_message: 'Platform not connected' },
      error:    `${req.platform} no está conectado`,
      errorCode:'not_connected',
    };
  }

  // 3. Scheduled → just persist, cron will run later.
  if (req.scheduledAt) {
    const pub = await upsertPublication(post.id, req);
    return { platform: req.platform, mode: 'scheduled', publication: pub };
  }

  // 4. Immediate → claim, publish, record outcome.
  const pub = await upsertPublication(post.id, req);
  await updatePublicationStatus(pub.id, 'publishing');
  try {
    const result = await provider.publish(normalized, connection);
    await markPublished(pub.id, result);
    await writeLegacyFields(post.id, req.platform, result);
    return {
      platform:     req.platform,
      mode:         'published',
      publication:  { ...pub, status: 'published',
                       platform_post_id: result.platformPostId,
                       platform_post_url: result.platformPostUrl ?? null,
                       published_at: result.publishedAt.toISOString() },
      publishResult: result,
    };
  } catch (err) {
    const msg  = err instanceof Error ? err.message : String(err);
    const code = err instanceof ProviderError ? err.code : 'platform_error';
    await updatePublicationStatus(pub.id, 'failed', { error: msg, code });
    return {
      platform: req.platform,
      mode:     'failed',
      publication: { ...pub, status: 'failed', error_message: msg },
      error:    msg,
      errorCode:code,
    };
  }
}

/**
 * Atomically claim a scheduled publication for execution — returns the row
 * if the claim succeeded (status moved from 'scheduled' to 'publishing'),
 * or null if another runner grabbed it first.
 */
export async function claimDuePublication(publicationId: string): Promise<PublicationRow | null> {
  const db = createAdminClient() as DB;
  const { data, error } = await db
    .from('post_publications')
    .update({ status: 'publishing', last_attempt_at: new Date().toISOString() })
    .eq('id', publicationId)
    .eq('status', 'scheduled')
    .select()
    .maybeSingle();
  if (error) throw error;
  return (data as PublicationRow | null) ?? null;
}

/**
 * Used by the publish-scheduled cron. Claims the row and runs the publish
 * via the platform's provider. Returns the outcome. Never throws — errors
 * are persisted onto the publication row and surfaced via the returned
 * object so the cron can count / report.
 */
export async function claimAndRun(publicationId: string): Promise<PublicationOutcome | null> {
  const claim = await claimDuePublication(publicationId);
  if (!claim) return null; // someone else got it

  const db = createAdminClient() as DB;
  const { data: post, error: postErr } = await db
    .from('posts')
    .select(`${POST_NORMALIZE_COLUMNS}, brand_id, status`)
    .eq('id', claim.post_id)
    .single();
  if (postErr || !post) {
    await updatePublicationStatus(claim.id, 'failed', { error: 'Post no longer exists', code: 'missing_post' });
    return {
      platform:    claim.platform,
      mode:        'failed',
      publication: { ...claim, status: 'failed', error_message: 'Post no longer exists' },
      error:       'Post no longer exists',
      errorCode:   'missing_post',
    };
  }

  const connection = await getConnection((post as PostRecord).brand_id, claim.platform);
  if (!connection) {
    await updatePublicationStatus(claim.id, 'failed', { error: 'Platform not connected', code: 'not_connected' });
    return {
      platform:    claim.platform,
      mode:        'failed',
      publication: { ...claim, status: 'failed', error_message: 'Platform not connected' },
      error:       'Platform not connected',
      errorCode:   'not_connected',
    };
  }

  const provider   = getProvider(claim.platform);
  const normalized = normalizePostRow(post as PostRecord, {
    caption:  claim.caption  ?? (post as PostRecord).caption  ?? undefined,
    hashtags: claim.hashtags.length ? claim.hashtags : (post as PostRecord).hashtags ?? undefined,
    metadata: claim.metadata,
  });

  try {
    const result = await provider.publish(normalized, connection);
    await markPublished(claim.id, result);
    await writeLegacyFields(claim.post_id, claim.platform, result);
    await maybeUpdatePostAggregateStatus(db, claim.post_id);
    return {
      platform:      claim.platform,
      mode:          'published',
      publication:   { ...claim, status: 'published',
                        platform_post_id: result.platformPostId,
                        platform_post_url: result.platformPostUrl ?? null,
                        published_at: result.publishedAt.toISOString() },
      publishResult: result,
    };
  } catch (err) {
    const msg  = err instanceof Error ? err.message : String(err);
    const code = err instanceof ProviderError ? err.code : 'platform_error';
    await updatePublicationStatus(claim.id, 'failed', { error: msg, code });
    return {
      platform:    claim.platform,
      mode:        'failed',
      publication: { ...claim, status: 'failed', error_message: msg },
      error:       msg,
      errorCode:   code,
    };
  }
}

/**
 * Returns every publication whose scheduled_at has elapsed and still reads
 * as 'scheduled'. The cron loops over these and calls claimAndRun.
 */
export async function listDuePublications(limit = 50): Promise<PublicationRow[]> {
  const db = createAdminClient() as DB;
  const nowIso = new Date().toISOString();
  const { data, error } = await db
    .from('post_publications')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', nowIso)
    .order('scheduled_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PublicationRow[];
}

// ─────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────

async function upsertPublication(
  postId: string,
  req:    PublicationRequest,
): Promise<PublicationRow> {
  const db = createAdminClient() as DB;
  const payload = {
    post_id:      postId,
    platform:     req.platform,
    caption:      req.caption  ?? null,
    hashtags:     req.hashtags ?? [],
    scheduled_at: req.scheduledAt?.toISOString() ?? null,
    status:       req.scheduledAt ? 'scheduled' : 'pending',
    metadata:     req.metadata ?? {},
  };
  const { data, error } = await db
    .from('post_publications')
    .upsert(payload, { onConflict: 'post_id,platform' })
    .select()
    .single();
  if (error) throw error;
  return data as PublicationRow;
}

async function updatePublicationStatus(
  pubId:  string,
  status: PublicationStatus,
  extras: { error?: string; code?: string } = {},
): Promise<void> {
  const db = createAdminClient() as DB;
  const update: Record<string, unknown> = {
    status,
    last_attempt_at: new Date().toISOString(),
  };
  if (extras.error) update.error_message = extras.error;
  if (extras.code)  update.metadata      = { error_code: extras.code };
  await db.from('post_publications').update(update).eq('id', pubId);
}

async function markPublished(pubId: string, result: PublishResult): Promise<void> {
  const db = createAdminClient() as DB;
  await db.from('post_publications').update({
    status:            'published',
    published_at:      result.publishedAt.toISOString(),
    platform_post_id:  result.platformPostId,
    platform_post_url: result.platformPostUrl ?? null,
    error_message:     null,
  }).eq('id', pubId);
}

/**
 * Writes the legacy per-platform columns on the posts row so old code
 * paths keep working until phase 1b drops them.
 */
async function writeLegacyFields(
  postId:   string,
  platform: Platform,
  result:   PublishResult,
): Promise<void> {
  const db = createAdminClient() as DB;
  const update: Record<string, unknown> = { published_at: result.publishedAt.toISOString() };
  if      (platform === 'instagram') update.ig_post_id      = result.platformPostId;
  else if (platform === 'facebook')  update.fb_post_id      = result.platformPostId;
  else if (platform === 'tiktok')    update.tiktok_video_id = result.platformPostId;
  await db.from('posts').update(update).eq('id', postId);
}

/**
 * Rolls up the per-publication statuses into the posts.status value so
 * screens that still read the old field don't break. Conservative:
 *   - any publication 'published'  → posts.status = 'published'
 *   - else any 'scheduled'         → 'scheduled'
 *   - else any 'failed'            → 'failed'
 *   - else leave it as-is
 */
async function maybeUpdatePostAggregateStatus(db: DB, postId: string): Promise<void> {
  const { data: pubs } = await db
    .from('post_publications')
    .select('status')
    .eq('post_id', postId);
  if (!pubs || pubs.length === 0) return;

  const statuses = new Set<string>((pubs as { status: string }[]).map(p => p.status));
  let next: string | null = null;
  if      (statuses.has('published')) next = 'published';
  else if (statuses.has('scheduled')) next = 'scheduled';
  else if (statuses.has('failed'))    next = 'failed';
  if (next) {
    await db.from('posts').update({ status: next }).eq('id', postId);
  }
}
