// POST /api/admin/backfill-publications
// Heals post_publications for the current brand:
//  1) UPSERTS a row per (post, platform) for every active post.
//     → fixes posts that were scheduled before the schedule/worker fix landed.
//  2) SYNCS scheduled_at on existing rows whose parent post was rescheduled
//     before the reschedule fix landed.
//  3) DELETES orphan rows whose parent post no longer exists
//     (defensive cleanup — the new DELETE route now handles this explicitly).
//
// Safe to re-run: step 1 uses UPSERT on (post_id, platform), step 2 is
// idempotent, step 3 only removes rows that are already dangling.

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

const VALID_PLATFORMS = ['instagram', 'facebook', 'tiktok'] as const;

export async function POST() {
  try {
    const user = await requireServerUser();
    const db: DB = createAdminClient();

    const { data: brand } = await db
      .from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    // ── Load active posts for this brand ────────────────────────────────────
    const { data: posts, error } = await db
      .from('posts')
      .select('id, platform, scheduled_at, status')
      .eq('brand_id', brand.id)
      .in('status', ['scheduled', 'approved', 'pending']);
    if (error) throw error;

    type PostRow = { id: string; platform: unknown; scheduled_at: string | null; status: string };
    const postList = (posts ?? []) as PostRow[];
    const postById = new Map<string, PostRow>(postList.map(p => [p.id, p]));

    // ── Step 1: UPSERT missing publications per (post, platform) ────────────
    type UpsertRow = { post_id: string; platform: string; scheduled_at: string | null; status: string };
    const upserts: UpsertRow[] = [];
    for (const p of postList) {
      const platforms = Array.isArray(p.platform) ? p.platform : (p.platform ? [p.platform] : []);
      for (const plat of platforms as string[]) {
        if (!VALID_PLATFORMS.includes(plat as typeof VALID_PLATFORMS[number])) continue;
        upserts.push({
          post_id:      p.id,
          platform:     plat,
          scheduled_at: p.scheduled_at,
          status:       p.status === 'scheduled' ? 'scheduled' : 'pending',
        });
      }
    }
    if (upserts.length > 0) {
      const { error: upsertErr } = await db
        .from('post_publications')
        .upsert(upserts, { onConflict: 'post_id,platform' });
      if (upsertErr) throw upsertErr;
    }

    // ── Step 2: SYNC scheduled_at on rows where post was rescheduled ────────
    // Fetch current publications for the posts we just touched, compare dates,
    // and patch any mismatch on non-terminal statuses.
    const activeIds = postList.map(p => p.id);
    let synced = 0;
    if (activeIds.length > 0) {
      const { data: pubs } = await db
        .from('post_publications')
        .select('id, post_id, scheduled_at, status')
        .in('post_id', activeIds)
        .in('status', ['pending', 'scheduled', 'failed']);

      type Pub = { id: string; post_id: string; scheduled_at: string | null; status: string };
      const misaligned: Array<{ id: string; expected: string | null }> = [];
      for (const pub of (pubs ?? []) as Pub[]) {
        const p = postById.get(pub.post_id);
        if (!p) continue;
        if (pub.scheduled_at !== p.scheduled_at) {
          misaligned.push({ id: pub.id, expected: p.scheduled_at });
        }
      }
      for (const m of misaligned) {
        await db
          .from('post_publications')
          .update({ scheduled_at: m.expected, status: 'scheduled' })
          .eq('id', m.id);
        synced += 1;
      }
    }

    // ── Step 3: DELETE orphans (publications pointing to non-existent posts) ─
    // Only checks publications belonging to this brand's posts that we know about.
    // Anything referencing a post not in our map AND not in the DB is orphan.
    const { data: allBrandPubs } = await db
      .from('post_publications')
      .select('id, post_id, posts!inner ( brand_id )');
    type PubWithPost = { id: string; post_id: string; posts: { brand_id: string } | null };
    const orphanIds: string[] = [];
    for (const pub of (allBrandPubs ?? []) as PubWithPost[]) {
      if (!pub.posts) orphanIds.push(pub.id);
      else if (pub.posts.brand_id !== brand.id) continue;
    }
    if (orphanIds.length > 0) {
      await db.from('post_publications').delete().in('id', orphanIds);
    }

    return NextResponse.json({
      ok:          true,
      upserted:    upserts.length,
      synced,
      orphansDeleted: orphanIds.length,
    });
  } catch (err) {
    return apiError(err, 'admin/backfill-publications');
  }
}
