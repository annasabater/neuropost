import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

// Tipos de special_requests permitidos en el esquema
const SPECIAL_TYPES = ['campaign', 'seasonal', 'custom', 'urgent', 'consultation', 'other'] as const;

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ brandId: string }> },
) {
  try {
    await requireWorker();
    const { brandId } = await ctx.params;
    const db = createAdminClient();

    const [specialRes, recreationRes] = await Promise.all([
      db
        .from('special_requests')
        .select('id, brand_id, title, description, type, status, assigned_worker_id, worker_response, deadline_at, created_at, completed_at')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false }),
      db
        .from('recreation_requests')
        .select('id, brand_id, client_notes, status, worker_notes, created_at')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false }),
    ]);

    // Unifica en una estructura común
    const special = (specialRes.data ?? []).map((r) => ({
      id: r.id,
      kind: 'special' as const,
      title: r.title,
      description: r.description,
      type: r.type,
      status: r.status,
      deadline_at: r.deadline_at,
      created_at: r.created_at,
      completed_at: r.completed_at,
      worker_response: r.worker_response,
    }));

    const recreations = (recreationRes.data ?? []).map((r) => ({
      id: r.id,
      kind: 'recreation' as const,
      title: 'Recreación',
      description: r.client_notes,
      type: 'recreation',
      status: r.status,
      deadline_at: null,
      created_at: r.created_at,
      completed_at: null,
      worker_response: r.worker_notes,
    }));

    const all = [...special, ...recreations].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    return NextResponse.json({ requests: all });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ brandId: string }> },
) {
  try {
    const worker = await requireWorker();
    const { brandId } = await ctx.params;
    const db = createAdminClient();

    const body = await req.json().catch(() => ({}));
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const type = typeof body.type === 'string' ? body.type : 'custom';
    const deadline = typeof body.deadline_at === 'string' && body.deadline_at ? body.deadline_at : null;

    if (!title) return NextResponse.json({ error: 'Título requerido' }, { status: 400 });
    if (!(SPECIAL_TYPES as readonly string[]).includes(type)) {
      return NextResponse.json({ error: 'Tipo no válido' }, { status: 400 });
    }

    // Verifica que la brand existe
    const { data: brand } = await db.from('brands').select('id').eq('id', brandId).single();
    if (!brand) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });

    const { data: inserted, error } = await db
      .from('special_requests')
      .insert({
        brand_id: brandId,
        title,
        description: description || null,
        type,
        status: 'accepted', // creada por un worker → ya aceptada
        assigned_worker_id: worker.id,
        deadline_at: deadline,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ request: inserted }, { status: 201 });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
