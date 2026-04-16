// ─────────────────────────────────────────────────────────────────────────────
// Vercel Cron — publishes every due `post_publications` row.
//
// This is the phase-2 rewrite: instead of reading the legacy
// posts.scheduled_at and publishing only to Instagram, we now walk the
// post_publications fan-out table, call provider.publish through the
// multi-platform factory, and persist the per-platform outcome.
//
// A small back-compat shim picks up any post whose scheduled_at has
// elapsed but has NO post_publications row yet (shouldn't happen after
// the phase-1 backfill, but defensive — synthesises an IG publication
// so nothing silently falls behind).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { markPostAsPublishedInFeedQueue } from '@/lib/feedQueue';
import {
  listDuePublications,
  claimAndRun,
} from '@/lib/posts/publications';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

const BATCH_LIMIT = 50;

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET ?? ''}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = createAdminClient() as DB;

  // ── Phase-2 path: walk post_publications ────────────────────────────────
  const due = await listDuePublications(BATCH_LIMIT);

  let published = 0;
  let failed    = 0;
  let skipped   = 0;
  const details: Array<{
    publicationId: string;
    postId:        string;
    platform:      string;
    outcome:       string;
    error?:        string;
  }> = [];

  for (const pub of due) {
    try {
      const outcome = await claimAndRun(pub.id);
      if (!outcome) {
        skipped++;
        details.push({ publicationId: pub.id, postId: pub.post_id, platform: pub.platform, outcome: 'claimed_elsewhere' });
        continue;
      }

      details.push({
        publicationId: pub.id,
        postId:        pub.post_id,
        platform:      pub.platform,
        outcome:       outcome.mode,
        error:         outcome.error,
      });

      if (outcome.mode === 'published') {
        published++;
        // Feed queue bookkeeping — once per post, on the first successful
        // platform. Keeps the old feed tracking working until phase 3.
        const { data: post } = await db
          .from('posts').select('brand_id, image_url, edited_image_url')
          .eq('id', pub.post_id).single();
        if (post) {
          const imageUrl = (post.edited_image_url ?? post.image_url ?? '') as string;
          if (imageUrl) {
            await markPostAsPublishedInFeedQueue(db, post.brand_id as string, pub.post_id, imageUrl)
              .catch(err => console.error('[publish-scheduled] feedQueue update failed:', err));
          }
        }
      } else {
        failed++;
      }

      const brandId = await brandIdForPost(db, pub.post_id);
      if (brandId) {
        await db.from('notifications').insert({
          brand_id: brandId,
          type:     outcome.mode === 'published' ? 'published' : 'failed',
          message:  outcome.mode === 'published'
            ? `Post publicado en ${pub.platform}.`
            : `Error al publicar en ${pub.platform}: ${outcome.error ?? 'desconocido'}`,
          read:     false,
          metadata: { postId: pub.post_id, publicationId: pub.id, platform: pub.platform },
        }).then(() => null).catch(() => null);
      }
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[publish-scheduled] unexpected error on publication ${pub.id}:`, err);
      details.push({
        publicationId: pub.id,
        postId:        pub.post_id,
        platform:      pub.platform,
        outcome:       'unexpected_error',
        error:         msg,
      });
    }
  }

  // ── Legacy safety net: posts with scheduled_at due but no publications ──
  // After the phase-1 backfill this query returns ~0 rows. If a future
  // regression ever stops populating post_publications, at least we surface
  // the orphans so they don't get silently left behind.
  const { data: orphans } = await db
    .from('posts')
    .select('id, brand_id, platform, scheduled_at')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .limit(10);

  let orphansDetected = 0;
  for (const o of (orphans ?? []) as Array<{ id: string }>) {
    const { data: pubs } = await db
      .from('post_publications')
      .select('id')
      .eq('post_id', o.id)
      .limit(1);
    if (!pubs || pubs.length === 0) {
      orphansDetected++;
      console.warn(`[publish-scheduled] ORPHAN: post ${o.id} is scheduled but has no post_publications row`);
    }
  }

  return NextResponse.json({
    checked:         due.length,
    published,
    failed,
    skipped,
    orphansDetected,
    details,
  });
}

async function brandIdForPost(db: DB, postId: string): Promise<string | null> {
  const { data } = await db.from('posts').select('brand_id').eq('id', postId).single();
  return (data?.brand_id as string | undefined) ?? null;
}
