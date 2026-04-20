// ─────────────────────────────────────────────────────────────────────────────
// Per-post publications endpoint — the multi-platform entry point.
//
//   GET  /api/posts/[id]/publications
//     → returns the list of per-platform publications for the post, each
//       with its own status, scheduled time, platform_post_id, etc.
//
//   POST /api/posts/[id]/publications
//     body: { publications: [
//       { platform: 'instagram' | 'facebook' | 'tiktok',
//         caption?:   string,   // platform-adapted override
//         hashtags?:  string[],
//         scheduledAt?: ISOstring | null,  // null → publish now
//         metadata?:  Record<string, unknown>,
//       }, ...
//     ]}
//     → runs each platform through the provider factory with per-platform
//       try/catch so one failing platform never aborts the others
//       (refactor contract, answer 7A). Returns an array of outcomes in
//       the same order as the request.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { rateLimitWrite } from '@/lib/ratelimit';
import { requireServerUser, createAdminClient } from '@/lib/supabase';
import { parsePlatform, type Platform } from '@/lib/platforms';
import {
  listPublications,
  requestPublications,
  type PublicationRequest,
} from '@/lib/posts/publications';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

// ─────────────────────────────────────────────────────────────────────────
// GET — list publications for a post
// ─────────────────────────────────────────────────────────────────────────
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user   = await requireServerUser();
    const db     = createAdminClient() as DB;

    // Ownership check — only the brand that owns the post (or a worker)
    // can list its publications.
    const { data: post } = await db
      .from('posts')
      .select('id, brand_id')
      .eq('id', id)
      .single();
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    const { data: brand } = await db
      .from('brands')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (!brand || brand.id !== post.brand_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const publications = await listPublications(id);
    return NextResponse.json({ publications });
  } catch (err) {
    return apiError(err, 'GET /api/posts/[id]/publications');
  }
}

// ─────────────────────────────────────────────────────────────────────────
// POST — create / update publications and optionally publish now
// ─────────────────────────────────────────────────────────────────────────

interface RawPublicationInput {
  platform?:     unknown;
  caption?:      unknown;
  hashtags?:     unknown;
  scheduledAt?:  unknown;
  metadata?:     unknown;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const rl = await rateLimitWrite(request);
    if (rl) return rl;

    const { id } = await params;
    const user   = await requireServerUser();
    const db     = createAdminClient() as DB;

    // Ownership check
    const { data: post } = await db
      .from('posts')
      .select('id, brand_id')
      .eq('id', id)
      .single();
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    const { data: brand } = await db
      .from('brands')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (!brand || brand.id !== post.brand_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse body
    const body = await request.json().catch(() => null) as { publications?: RawPublicationInput[] } | null;
    if (!body || !Array.isArray(body.publications) || body.publications.length === 0) {
      return NextResponse.json(
        { error: 'Body must be { publications: [{ platform, ... }] }' },
        { status: 400 },
      );
    }

    const requests: PublicationRequest[] = [];
    const seen = new Set<Platform>();

    for (const raw of body.publications) {
      const platform = parsePlatform(raw.platform);
      if (!platform) {
        return NextResponse.json(
          { error: `Invalid platform: ${String(raw.platform)}` },
          { status: 400 },
        );
      }
      if (seen.has(platform)) {
        return NextResponse.json(
          { error: `Duplicate platform in request: ${platform}` },
          { status: 400 },
        );
      }
      seen.add(platform);

      let scheduledAt: Date | null = null;
      if (raw.scheduledAt != null) {
        const parsed = new Date(raw.scheduledAt as string);
        if (isNaN(parsed.getTime())) {
          return NextResponse.json(
            { error: `Invalid scheduledAt for ${platform}` },
            { status: 400 },
          );
        }
        scheduledAt = parsed;
      }

      requests.push({
        platform,
        caption:     typeof raw.caption  === 'string' ? raw.caption  : undefined,
        hashtags:    Array.isArray(raw.hashtags)
                       ? (raw.hashtags as unknown[]).filter((h): h is string => typeof h === 'string')
                       : undefined,
        scheduledAt,
        metadata:    raw.metadata && typeof raw.metadata === 'object'
                       ? raw.metadata as Record<string, unknown>
                       : undefined,
      });
    }

    const outcomes = await requestPublications(id, requests);

    // 200 regardless of per-platform failures — the caller inspects each
    // outcome. This matches the "one failure doesn't block the others"
    // contract (answer 7A).
    return NextResponse.json({ outcomes });
  } catch (err) {
    return apiError(err, 'POST /api/posts/[id]/publications');
  }
}
