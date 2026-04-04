import { NextResponse } from 'next/server';
import { requireSuperAdmin, adminErrorResponse } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    await requireSuperAdmin();
    const db = createAdminClient();
    const { commentId } = await request.json() as { commentId: string };

    if (!commentId) {
      return NextResponse.json({ error: 'commentId is required' }, { status: 400 });
    }

    const { data: comment } = await db
      .from('outbound_comments')
      .select('comment_ig_id, prospect_reply_id, prospect_id, prospect_reply_liked')
      .eq('id', commentId)
      .single();

    if (!comment) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    if (comment.prospect_reply_liked) return NextResponse.json({ ok: true, already: true });

    const { data: brand } = await db
      .from('brands')
      .select('meta_access_token')
      .not('meta_access_token', 'is', null)
      .limit(1)
      .single();

    // Like the prospect's reply (or the original comment if no reply)
    const targetId = comment.prospect_reply_id ?? comment.comment_ig_id;

    if (brand?.meta_access_token && targetId) {
      await fetch(`https://graph.facebook.com/v19.0/${targetId}/likes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: brand.meta_access_token }),
      });
    }

    const now = new Date().toISOString();

    await db.from('outbound_comments').update({
      prospect_reply_liked:    true,
      prospect_reply_liked_at: now,
      updated_at:              now,
    }).eq('id', commentId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const { error, status } = adminErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
