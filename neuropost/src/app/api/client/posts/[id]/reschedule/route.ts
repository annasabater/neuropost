import { NextResponse }      from 'next/server';
import { requireServerUser } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase';
import { apiError }          from '@/lib/api-utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

interface RescheduleBody {
  new_scheduled_at: string;
  change_reason?:   string;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user   = await requireServerUser();
    const { id } = await params;
    const db     = createAdminClient() as DB;
    const body   = await req.json() as RescheduleBody;

    const { new_scheduled_at, change_reason } = body;
    if (!new_scheduled_at) {
      return NextResponse.json({ error: 'new_scheduled_at es obligatorio' }, { status: 400 });
    }

    const newDt = new Date(new_scheduled_at);
    if (isNaN(newDt.getTime())) {
      return NextResponse.json({ error: 'new_scheduled_at no es una fecha válida' }, { status: 400 });
    }
    if (newDt <= new Date()) {
      return NextResponse.json({ error: 'No se puede programar en el pasado' }, { status: 400 });
    }

    // Load post + brand ownership check
    const { data: post } = await db
      .from('posts')
      .select('id, brand_id, scheduled_at, status, brands!inner ( user_id )')
      .eq('id', id)
      .single();

    if (!post) return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 });
    if (post.brands?.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check collision: another post from same brand at exact same time
    const { data: collision } = await db
      .from('posts')
      .select('id')
      .eq('brand_id', post.brand_id)
      .eq('scheduled_at', newDt.toISOString())
      .neq('id', id)
      .maybeSingle();

    if (collision) {
      return NextResponse.json(
        { error: 'Ya existe otro post programado a esa hora exacta' },
        { status: 409 },
      );
    }

    // Find week_id via content_ideas
    const { data: ideaRow } = await db
      .from('content_ideas')
      .select('week_id')
      .eq('post_id', id)
      .maybeSingle();

    // UPDATE post scheduled_at
    const { data: updatedPost, error: updateErr } = await db
      .from('posts')
      .update({ scheduled_at: newDt.toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (updateErr) throw updateErr;
    if (!updatedPost) {
      console.error('[reschedule] UPDATE devolvió 0 filas — posible bloqueo RLS');
      throw new Error('No se pudo actualizar el post');
    }

    // Sync per-platform publications with the new scheduled time so the Feed
    // "En directo" grid and the publish cron read the right date.
    // We only touch rows that haven't been published/cancelled yet.
    await db
      .from('post_publications')
      .update({ scheduled_at: newDt.toISOString(), status: 'scheduled' })
      .eq('post_id', id)
      .in('status', ['pending', 'scheduled', 'failed']);

    // INSERT schedule_change audit row
    await db.from('schedule_changes').insert({
      post_id:            id,
      week_id:            ideaRow?.week_id ?? null,
      brand_id:           post.brand_id,
      changed_by_user_id: user.id,
      changed_by_role:    'client',
      old_scheduled_at:   post.scheduled_at ?? null,
      new_scheduled_at:   newDt.toISOString(),
      change_reason:      change_reason ?? null,
    });

    return NextResponse.json({ ok: true, post: updatedPost });
  } catch (err) {
    return apiError(err, 'POST /api/client/posts/[id]/reschedule');
  }
}
