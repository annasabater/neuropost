import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { replyToComment } from '@/lib/meta';
import type { Comment, Brand } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user       = await requireServerUser();
    const { id }     = await params;
    const { message } = await request.json() as { message: string };
    const supabase    = await createServerClient() as DB;

    if (!message?.trim()) {
      return NextResponse.json({ error: 'El mensaje no puede estar vacío' }, { status: 400 });
    }

    // Get brand (to get access token)
    const { data: brand } = await supabase
      .from('brands')
      .select('id,ig_access_token,fb_access_token')
      .eq('user_id', user.id)
      .single();

    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const typedBrand = brand as Brand;

    // Get comment
    const { data: comment } = await supabase
      .from('comments')
      .select('*')
      .eq('id', id)
      .eq('brand_id', typedBrand.id)
      .single();

    if (!comment) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });

    const typedComment = comment as Comment;

    const accessToken = typedComment.platform === 'instagram'
      ? typedBrand.ig_access_token
      : typedBrand.fb_access_token;

    if (!accessToken) {
      return NextResponse.json(
        { error: `${typedComment.platform === 'instagram' ? 'Instagram' : 'Facebook'} no está conectado` },
        { status: 400 },
      );
    }

    // Post reply to Meta
    const { replyId } = await replyToComment({
      commentId:   typedComment.external_id,
      message:     message.trim(),
      accessToken,
    });

    // Update comment status
    await supabase
      .from('comments')
      .update({ status: 'replied', ai_reply: message.trim() })
      .eq('id', id);

    // Activity log
    await supabase.from('activity_log').insert({
      brand_id:    typedBrand.id,
      user_id:     user.id,
      action:      'comment_replied',
      entity_type: 'comment',
      entity_id:   id,
      details:     { reply_id: replyId },
    });

    return NextResponse.json({ ok: true, replyId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
