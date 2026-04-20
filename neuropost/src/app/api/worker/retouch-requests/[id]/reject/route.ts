import { NextResponse }  from 'next/server';
import { requireWorker } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';
import { apiError }      from '@/lib/api-utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const worker = await requireWorker();
    const { id } = await params;
    const db     = createAdminClient() as DB;
    const body   = await req.json() as { reason: string };

    if (!body.reason?.trim()) {
      return NextResponse.json({ error: 'El motivo es obligatorio' }, { status: 400 });
    }

    const { data: retouch } = await db
      .from('retouch_requests')
      .select('id, post_id, status, brand_id')
      .eq('id', id)
      .single();

    if (!retouch) return NextResponse.json({ error: 'Retouch no encontrado' }, { status: 404 });
    if (retouch.status !== 'pending') {
      return NextResponse.json({ error: `Estado inválido: ${retouch.status as string}` }, { status: 409 });
    }

    const { data: updatedRetouch, error: updateErr } = await db
      .from('retouch_requests')
      .update({
        status:                 'rejected',
        resolved_at:            new Date().toISOString(),
        resolved_by_worker_id:  worker.id,
        resolution_notes:       body.reason,
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (updateErr) throw updateErr;
    if (!updatedRetouch) {
      console.error('[retouch-reject] UPDATE devolvió 0 filas');
      throw new Error('No se pudo actualizar la retouch_request');
    }

    await db.from('notifications').insert({
      brand_id: retouch.brand_id,
      type:     'post.retouch_rejected',
      message:  'Tu petición de retoque no pudo aplicarse',
      read:     false,
      metadata: { retouch_id: id, post_id: retouch.post_id, reason: body.reason },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, 'POST /api/worker/retouch-requests/[id]/reject');
  }
}
