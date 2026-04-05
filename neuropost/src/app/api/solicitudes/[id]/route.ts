import { NextResponse } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireWorker();
    const db = createAdminClient();
    const body = await request.json();
    const { status, worker_response } = body;

    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (worker_response) updates.worker_response = worker_response;
    if (status === 'completed') updates.completed_at = new Date().toISOString();

    const { data: req, error } = await db
      .from('special_requests')
      .update(updates)
      .eq('id', id)
      .select('*, brands(id, name)')
      .single();
    if (error) throw error;

    // Notify client
    const statusMsg: Record<string, string> = {
      accepted: 'Tu solicitud ha sido aceptada',
      rejected: 'Tu solicitud no ha podido ser aceptada',
      in_progress: 'Tu solicitud está en proceso',
      completed: 'Tu solicitud está lista para revisar',
    };
    if (statusMsg[status]) {
      await db.from('notifications').insert({
        brand_id: (req.brands as any).id,
        type: 'request_update',
        message: statusMsg[status],
        read: false,
        metadata: { request_id: id, status },
      }).catch(() => null);
    }

    return NextResponse.json({ request: req });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
