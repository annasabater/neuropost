import { NextResponse } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const worker  = await requireWorker();
    const db      = createAdminClient();
    const { searchParams } = new URL(request.url);
    const status  = searchParams.get('status');
    const brandId = searchParams.get('brandId');

    let query = db
      .from('content_queue')
      .select(`
        *,
        posts ( id, image_url, edited_image_url, caption, hashtags, format, platform, quality_score, client_notes_for_worker ),
        brands ( id, name, sector )
      `)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(100);

    // Workers only see their assigned brands (unless admin/senior)
    if (worker.role === 'worker' && worker.brands_assigned?.length) {
      query = query.in('brand_id', worker.brands_assigned);
    }
    if (status) query = query.eq('status', status);
    if (brandId) query = query.eq('brand_id', brandId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ queue: data ?? [] });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const worker = await requireWorker();
    const body   = await request.json() as {
      queueId:      string;
      status:       string;
      worker_notes?: string;
      priority?:    string;
    };

    const db = createAdminClient();

    const updates: Record<string, unknown> = {
      status:              body.status,
      worker_reviewed_at:  new Date().toISOString(),
      assigned_worker_id:  worker.id,
    };
    if (body.worker_notes !== undefined) updates.worker_notes = body.worker_notes;
    if (body.priority !== undefined)     updates.priority     = body.priority;

    const { data, error } = await db
      .from('content_queue')
      .update(updates)
      .eq('id', body.queueId)
      .select()
      .single();

    if (error) throw error;

    // Notify client when worker approves
    if (body.status === 'sent_to_client') {
      const { data: queue } = await db
        .from('content_queue')
        .select('brand_id, post_id')
        .eq('id', body.queueId)
        .single();
      if (queue) {
        await db.from('notifications').insert({
          brand_id: queue.brand_id,
          type:     'approval_needed',
          message:  '✅ Tu contenido está listo para revisar. Entra a aprobarlo.',
          read:     false,
          metadata: { postId: queue.post_id, queueId: body.queueId },
        });
      }
    }

    return NextResponse.json({ item: data });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
