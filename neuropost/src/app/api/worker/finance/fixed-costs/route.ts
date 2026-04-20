import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAdminWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';
import { logWorkerAction } from '@/lib/audit';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function GET() {
  try {
    await requireAdminWorker();
    const db: DB = createAdminClient();
    const { data, error } = await db.from('fixed_costs').select('*').order('category').order('name');
    if (error) throw error;
    return NextResponse.json({ costs: data ?? [] });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const worker = await requireAdminWorker();
    const db: DB = createAdminClient();
    const body = await req.json();
    const { data, error } = await db.from('fixed_costs').insert({
      category:   body.category,
      name:       body.name,
      amount_eur: body.amount_eur,
      notes:      body.notes ?? null,
    }).select().single();
    if (error) throw error;
    void logWorkerAction(worker.id, worker.full_name ?? '', 'create', 'fixed_cost',
      `Añadió gasto fijo: ${body.name} (${body.amount_eur}€/mes)`, { resource_id: data.id });
    return NextResponse.json({ cost: data }, { status: 201 });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const worker = await requireAdminWorker();
    const db: DB = createAdminClient();
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    updates.updated_at = new Date().toISOString();
    const { data, error } = await db.from('fixed_costs').update(updates).eq('id', id).select().single();
    if (error) throw error;
    void logWorkerAction(worker.id, worker.full_name ?? '', 'update', 'fixed_cost',
      `Editó gasto fijo: ${data.name}`, { resource_id: id });
    return NextResponse.json({ cost: data });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const worker = await requireAdminWorker();
    const db: DB = createAdminClient();
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { error } = await db.from('fixed_costs').delete().eq('id', id);
    if (error) throw error;
    void logWorkerAction(worker.id, worker.full_name ?? '', 'delete', 'fixed_cost',
      `Eliminó gasto fijo`, { resource_id: id, severity: 'warning' });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
