import { NextResponse } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const worker = await requireWorker();
    const { id } = await params;
    const body = await request.json() as {
      status:        'in_progress' | 'completed' | 'rejected';
      worker_notes?: string;
    };

    if (!body.status) {
      return NextResponse.json({ error: 'El campo status es obligatorio' }, { status: 400 });
    }

    const db = createAdminClient();

    const updates: Record<string, unknown> = {
      status:      body.status,
      worker_id:   worker.id,
      updated_at:  new Date().toISOString(),
    };
    if (body.worker_notes !== undefined) updates.worker_notes = body.worker_notes;

    const { data: recreation, error } = await db
      .from('recreation_requests')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        inspiration_references ( title, thumbnail_url, source_url, notes ),
        brands ( name )
      `)
      .single();
    if (error) throw error;

    // Notify brand when recreation is completed
    if (body.status === 'completed' && recreation) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const brandId = (recreation as any).brand_id;
      if (brandId) {
        try {
          await db.from('notifications').insert({
            brand_id: brandId,
            type:     'approval_needed',
            message:  '✅ Tu solicitud de recreación ha sido completada. Entra a revisarla.',
            read:     false,
            metadata: { recreation_id: id },
          });
        } catch { /* non-critical */ }
      }
    }

    return NextResponse.json({ recreation });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
