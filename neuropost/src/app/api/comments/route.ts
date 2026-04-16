import { NextResponse } from 'next/server';
import { requireServerUser, createAdminClient } from '@/lib/supabase';
import { queueJob } from '@/lib/agents/queue';
import { apiError, parsePagination } from '@/lib/api-utils';
import { rateLimitWrite } from '@/lib/ratelimit';

// GET /api/comments — returns comments for the user's brand (paginated)
export async function GET(request: Request) {
  try {
    const user = await requireServerUser();
    const db = createAdminClient();
    const { limit, offset } = parsePagination(request, 200, 100);

    const { data: brand } = await db
      .from('brands')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { data: comments, error } = await db
      .from('comments')
      .select('*')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({ comments: comments ?? [] });
  } catch (err) {
    return apiError(err, 'GET /api/comments');
  }
}

// POST /api/comments — client submits a comment, agent processes it
export async function POST(request: Request) {
  try {
    const user = await requireServerUser();
    const db = createAdminClient();
    const body = await request.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content required' }, { status: 400 });
    }

    const { data: brand } = await db
      .from('brands')
      .select('id, name')
      .eq('user_id', user.id)
      .single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    // Get user display name
    const { data: { user: authUser } } = await db.auth.getUser();
    const meta = authUser?.user_metadata ?? {};
    const authorName = [meta.first_name, meta.last_name].filter(Boolean).join(' ') || brand.name || 'Cliente';

    const externalId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const { data: comment, error } = await db.from('comments').insert({
      brand_id: brand.id,
      platform: 'web',
      external_id: externalId,
      author: authorName,
      content: content.trim(),
      status: 'pending',
    }).select().single();

    if (error) throw error;

    // Queue agent to process the comment (fire-and-forget)
    queueJob({
      brand_id: brand.id,
      agent_type: 'support',
      action: 'handle_interactions',
      input: {
        source: 'comment',
        interactions: [{
          id: externalId,
          type: 'comment',
          platform: 'web',
          authorId: user.id,
          authorName,
          text: content.trim(),
          timestamp: new Date().toISOString(),
        }],
        autoPostReplies: false,
        external_id: externalId,
      },
      priority: 60,
      requested_by: 'client',
    }).catch(() => null);

    return NextResponse.json({ comment }, { status: 201 });
  } catch (err) {
    return apiError(err, 'POST /api/comments');
  }
}
