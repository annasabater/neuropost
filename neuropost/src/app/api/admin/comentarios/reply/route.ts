import { NextResponse } from 'next/server';
import { requireSuperAdmin, adminErrorResponse } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const user = await requireSuperAdmin();
    const db   = createAdminClient();
    const { commentId, text } = await request.json() as { commentId: string; text: string };

    if (!commentId || !text?.trim()) {
      return NextResponse.json({ error: 'commentId and text are required' }, { status: 400 });
    }

    // Fetch comment and prospect to get IG credentials
    const { data: comment } = await db
      .from('outbound_comments')
      .select('*, prospects(ig_account_id)')
      .eq('id', commentId)
      .single();

    if (!comment) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });

    // Get Meta access token from brand connected account
    const { data: brand } = await db
      .from('brands')
      .select('meta_access_token')
      .not('meta_access_token', 'is', null)
      .limit(1)
      .single();

    let replyIgId: string | null = null;

    if (brand?.meta_access_token && comment.comment_ig_id) {
      try {
        const res = await fetch(
          `https://graph.facebook.com/v19.0/${comment.comment_ig_id}/replies`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text.trim(), access_token: brand.meta_access_token }),
          },
        );
        const json = await res.json() as { id?: string };
        replyIgId = json.id ?? null;
      } catch {
        // Log but don't fail — still save the reply locally
      }
    }

    const now = new Date().toISOString();

    await db.from('outbound_comments').update({
      status:     'replied_by_us',
      our_reply:  text.trim(),
      replied_at: now,
      updated_at: now,
    }).eq('id', commentId);

    // Log interaction on prospect
    if (comment.prospect_id) {
      await db.from('prospect_interactions').insert({
        prospect_id: comment.prospect_id,
        type:        'comment_sent',
        content:     text.trim(),
        metadata:    { comment_id: commentId, ig_reply_id: replyIgId, sent_by: user.id },
      });

      await db.from('prospects').update({
        last_activity: now,
        updated_at:    now,
      }).eq('id', comment.prospect_id);
    }

    return NextResponse.json({ ok: true, ig_reply_id: replyIgId });
  } catch (err) {
    const { error, status } = adminErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
