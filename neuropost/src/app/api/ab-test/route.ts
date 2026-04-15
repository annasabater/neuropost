// =============================================================================
// POST /api/ab-test — create A/B test for a post's caption
// GET  /api/ab-test — list active/completed tests for brand
// =============================================================================
// Creates variant B using the CopywriterAgent, stores both in ab_tests table.
// The publish cron rotates between A and B mid-week, then picks the winner.

import { NextResponse } from 'next/server';
import { apiError, parsePagination } from '@/lib/api-utils';
import { rateLimitWrite } from '@/lib/ratelimit';
import { requireServerUser, createAdminClient } from '@/lib/supabase';
import { queueJob } from '@/lib/agents/queue';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function GET(request: Request) {
  try {
    const user = await requireServerUser();
    const db = createAdminClient() as DB;
    const { limit, offset } = parsePagination(request, 50, 20);

    const { data: brand } = await db.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { data, error } = await db
      .from('ab_tests')
      .select('*, posts(caption, image_url, edited_image_url, format)')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;

    return NextResponse.json({ ab_tests: data ?? [] });
  } catch (err) {
    return apiError(err, 'GET /api/ab-test');
  }
}

export async function POST(request: Request) {
  try {
    const rl = await rateLimitWrite(request);
    if (rl) return rl;

    const user = await requireServerUser();
    const db = createAdminClient() as DB;
    const body = await request.json() as { post_id: string };

    if (!body.post_id) {
      return NextResponse.json({ error: 'post_id requerido' }, { status: 400 });
    }

    const { data: brand } = await db.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    // Load post
    const { data: post } = await db
      .from('posts')
      .select('id, caption, hashtags, format, image_url, edited_image_url')
      .eq('id', body.post_id)
      .eq('brand_id', brand.id)
      .single();
    if (!post) return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 });
    if (!post.caption) return NextResponse.json({ error: 'El post necesita un caption para hacer A/B test' }, { status: 400 });

    // Check no existing active test for this post
    const { data: existing } = await db
      .from('ab_tests')
      .select('id')
      .eq('post_id', post.id)
      .eq('status', 'running')
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: 'Ya hay un A/B test activo para este post' }, { status: 409 });
    }

    // Create test with variant A = current caption, variant B = pending (agent will fill)
    const { data: test, error } = await db
      .from('ab_tests')
      .insert({
        brand_id:   brand.id,
        post_id:    post.id,
        caption_a:  post.caption,
        hashtags_a: post.hashtags ?? [],
        caption_b:  '[Generando variante B...]',
        hashtags_b: post.hashtags ?? [],
        status:     'running',
      })
      .select()
      .single();
    if (error) throw error;

    // Queue caption generation for variant B
    queueJob({
      brand_id:     brand.id,
      agent_type:   'content',
      action:       'generate_caption',
      input: {
        goal:        'engagement',
        platforms:   ['instagram'],
        postContext:  post.caption,
        topic:       post.caption.slice(0, 100),
        _ab_test_id: test.id,
        _variant:    'b',
        _post_id:    post.id,
      },
      priority:     75,
      requested_by: 'client',
    }).catch(() => null);

    return NextResponse.json({ ab_test: test }, { status: 201 });
  } catch (err) {
    return apiError(err, 'POST /api/ab-test');
  }
}
