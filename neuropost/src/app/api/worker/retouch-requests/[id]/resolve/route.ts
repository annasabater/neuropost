import { NextResponse }  from 'next/server';
import { requireWorker } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';
import { apiError }      from '@/lib/api-utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

interface ResolveBody {
  resolution_notes?: string;
  apply_to_post?: {
    caption?:      string;
    scheduled_at?: string;
  };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const worker = await requireWorker();
    const { id } = await params;
    const db     = createAdminClient() as DB;
    const body   = await req.json() as ResolveBody;

    const { data: retouch } = await db
      .from('retouch_requests')
      .select('id, post_id, status, brand_id')
      .eq('id', id)
      .single();

    if (!retouch) return NextResponse.json({ error: 'Retouch no encontrado' }, { status: 404 });
    if (retouch.status !== 'pending') {
      return NextResponse.json({ error: `Estado inválido: ${retouch.status as string}` }, { status: 409 });
    }

    // Apply changes to post if provided
    if (body.apply_to_post && Object.keys(body.apply_to_post).length > 0) {
      const postUpdate: Record<string, unknown> = {};
      if (body.apply_to_post.caption      != null) postUpdate.caption      = body.apply_to_post.caption;
      if (body.apply_to_post.scheduled_at != null) postUpdate.scheduled_at = body.apply_to_post.scheduled_at;
      if (Object.keys(postUpdate).length > 0) {
        await db.from('posts').update(postUpdate).eq('id', retouch.post_id);
      }
    }

    // Mark resolved
    const { data: updatedRetouch, error: updateErr } = await db
      .from('retouch_requests')
      .update({
        status:                  'resolved',
        resolved_at:             new Date().toISOString(),
        resolved_by_worker_id:   worker.id,
        resolution_notes:        body.resolution_notes ?? null,
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (updateErr) throw updateErr;
    if (!updatedRetouch) {
      console.error('[retouch-resolve] UPDATE devolvió 0 filas — posible bloqueo RLS');
      throw new Error('No se pudo actualizar la retouch_request');
    }

    // Notify client
    await db.from('notifications').insert({
      brand_id: retouch.brand_id,
      type:     'post.retouch_resolved',
      message:  'Tu petición de retoque ha sido aplicada',
      read:     false,
      metadata: { retouch_id: id, post_id: retouch.post_id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, 'POST /api/worker/retouch-requests/[id]/resolve');
  }
}
