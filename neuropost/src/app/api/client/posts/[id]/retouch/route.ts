import { NextResponse }       from 'next/server';
import { requireServerUser }  from '@/lib/supabase';
import { createAdminClient }  from '@/lib/supabase';
import { apiError }           from '@/lib/api-utils';
import type { RetouchType }   from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

interface RetouchBody {
  retouch_type:     RetouchType;
  requested_value?: {
    new_copy?:         string;
    new_scheduled_at?: string;
  };
  client_comment?: string;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user       = await requireServerUser();
    const { id }     = await params;
    const db         = createAdminClient() as DB;
    const body       = await req.json() as RetouchBody;

    const { retouch_type, requested_value, client_comment } = body;
    if (!retouch_type || !['copy', 'schedule', 'freeform'].includes(retouch_type)) {
      return NextResponse.json({ error: 'retouch_type inválido' }, { status: 400 });
    }

    // Load post + brand ownership check
    const { data: post } = await db
      .from('posts')
      .select('id, brand_id, caption, scheduled_at, status, brands!inner ( user_id )')
      .eq('id', id)
      .single();

    if (!post) return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 });
    if (post.brands?.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Find the week_id via content_ideas
    const { data: ideaRow } = await db
      .from('content_ideas')
      .select('week_id')
      .eq('post_id', id)
      .maybeSingle();

    if (!ideaRow?.week_id) {
      return NextResponse.json({ error: 'Este post no está vinculado a un plan semanal' }, { status: 400 });
    }

    // Snapshot original value
    const original_value: Record<string, unknown> = {};
    if (retouch_type === 'copy')     original_value.caption      = post.caption;
    if (retouch_type === 'schedule') original_value.scheduled_at = post.scheduled_at;

    // Insert retouch_request
    const { data: retouch, error: insertErr } = await db
      .from('retouch_requests')
      .insert({
        post_id:               id,
        week_id:               ideaRow.week_id,
        brand_id:              post.brand_id,
        requested_by_user_id:  user.id,
        retouch_type,
        original_value,
        requested_value:       requested_value ?? null,
        client_comment:        client_comment  ?? null,
        status:                'pending',
      })
      .select('id')
      .single();

    if (insertErr) throw insertErr;

    // Mark post as retouched
    await db
      .from('posts')
      .update({ client_retouched_at: new Date().toISOString() })
      .eq('id', id);

    // Notify worker
    await db.from('notifications').insert({
      brand_id: post.brand_id,
      type:     'post.retouch_requested_by_client',
      message:  `Retoque solicitado: ${retouch_type}`,
      read:     false,
      metadata: {
        post_id:         id,
        retouch_id:      retouch?.id ?? null,
        retouch_type,
        client_comment:  client_comment ?? null,
      },
    });

    return NextResponse.json({ ok: true, retouch_id: retouch?.id });
  } catch (err) {
    return apiError(err, 'POST /api/client/posts/[id]/retouch');
  }
}
