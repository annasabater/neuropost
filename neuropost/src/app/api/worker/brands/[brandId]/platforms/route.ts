// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/worker/brands/[brandId]/platforms
//  Aggregate view backing the worker's /worker/clientes/[brandId]/plataformas
//  page. Returns everything the UI needs in one round-trip:
//
//    - connections[]   — one row per connected platform (status, username,
//                        last_token_refresh_at, last_insights_synced_at)
//    - publications[]  — last 20 post_publications rows per platform
//                        joined with posts (image_url, format, status),
//                        newest first
//    - scheduled[]     — upcoming post_publications with scheduled_at > now
//                        per platform, oldest (next-to-fire) first
//    - stats           — per-platform counters: total_published,
//                        published_last_30d, scheduled_pending, failures_7d
//
//  Worker-only (requires requireWorkerForBrand).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { requireWorkerForBrand, workerErrorResponse } from '@/lib/worker';
import { ALL_PLATFORMS, type Platform } from '@/lib/platforms';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

interface PublicationWithPost {
  id:               string;
  post_id:          string;
  platform:         Platform;
  status:           string;
  scheduled_at:     string | null;
  published_at:     string | null;
  platform_post_id: string | null;
  platform_post_url:string | null;
  error_message:    string | null;
  created_at:       string;
  post: {
    id:               string;
    caption:          string | null;
    image_url:        string | null;
    edited_image_url: string | null;
    format:           string | null;
    status:           string;
  } | null;
}

interface ConnectionRow {
  platform:                Platform;
  platform_user_id:        string;
  platform_username:       string | null;
  status:                  string;
  expires_at:              string | null;
  last_token_refresh_at:   string | null;
  last_insights_synced_at: string | null;
  last_feed_synced_at:     string | null;
  metadata:                Record<string, unknown> | null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    await requireWorkerForBrand(brandId);

    const db       = createAdminClient() as DB;
    const nowIso   = new Date().toISOString();
    const last30d  = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const last7d   = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000).toISOString();

    // ── Connections ───────────────────────────────────────────────────────
    const { data: connectionsRaw } = await db
      .from('platform_connections')
      .select(`
        platform, platform_user_id, platform_username, status,
        expires_at, last_token_refresh_at, last_insights_synced_at,
        last_feed_synced_at, metadata
      `)
      .eq('brand_id', brandId);

    const connections = (connectionsRaw ?? []) as ConnectionRow[];

    // ── Recent publications joined with posts (20 most recent per platform) ─
    //  Supabase's PostgREST doesn't do per-platform LIMIT nicely, so fetch
    //  the newest 60 across all platforms and bucket client-side.
    const { data: publicationsRaw } = await db
      .from('post_publications')
      .select(`
        id, post_id, platform, status, scheduled_at, published_at,
        platform_post_id, platform_post_url, error_message, created_at,
        post:posts!inner(
          id, caption, image_url, edited_image_url, format, status
        )
      `)
      .eq('posts.brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(60);

    const pubs = (publicationsRaw ?? []) as PublicationWithPost[];

    // ── Upcoming scheduled publications ───────────────────────────────────
    const { data: scheduledRaw } = await db
      .from('post_publications')
      .select(`
        id, post_id, platform, scheduled_at, status,
        post:posts!inner(id, caption, image_url, edited_image_url, format)
      `)
      .eq('status', 'scheduled')
      .gte('scheduled_at', nowIso)
      .eq('posts.brand_id', brandId)
      .order('scheduled_at', { ascending: true })
      .limit(30);

    const scheduled = (scheduledRaw ?? []) as PublicationWithPost[];

    // ── Stats per platform ────────────────────────────────────────────────
    //  One count query per (platform, bucket) — still cheap thanks to the
    //  composite index on (status, platform).
    const stats: Record<Platform, {
      total_published:    number;
      published_last_30d: number;
      scheduled_pending:  number;
      failures_7d:        number;
    }> = {
      instagram: { total_published: 0, published_last_30d: 0, scheduled_pending: 0, failures_7d: 0 },
      facebook:  { total_published: 0, published_last_30d: 0, scheduled_pending: 0, failures_7d: 0 },
      tiktok:    { total_published: 0, published_last_30d: 0, scheduled_pending: 0, failures_7d: 0 },
    };

    for (const platform of ALL_PLATFORMS) {
      const [total, last30, sched, fails] = await Promise.all([
        db.from('post_publications').select('id', { count: 'exact', head: true })
          .eq('platform', platform).eq('status', 'published')
          .eq('posts.brand_id', brandId),
        db.from('post_publications').select('id', { count: 'exact', head: true })
          .eq('platform', platform).eq('status', 'published')
          .gte('published_at', last30d)
          .eq('posts.brand_id', brandId),
        db.from('post_publications').select('id', { count: 'exact', head: true })
          .eq('platform', platform).eq('status', 'scheduled')
          .gte('scheduled_at', nowIso)
          .eq('posts.brand_id', brandId),
        db.from('post_publications').select('id', { count: 'exact', head: true })
          .eq('platform', platform).eq('status', 'failed')
          .gte('last_attempt_at', last7d)
          .eq('posts.brand_id', brandId),
      ]);

      stats[platform] = {
        total_published:    total.count ?? 0,
        published_last_30d: last30.count ?? 0,
        scheduled_pending:  sched.count ?? 0,
        failures_7d:        fails.count ?? 0,
      };
    }

    return NextResponse.json({
      brandId,
      connections,
      publications: pubs,
      scheduled,
      stats,
      generatedAt:  nowIso,
    });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
