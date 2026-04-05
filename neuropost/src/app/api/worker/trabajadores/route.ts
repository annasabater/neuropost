import { NextResponse } from 'next/server';
import { requireAdminWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';
import type { WorkerRole } from '@/types';

export async function GET() {
  try {
    await requireAdminWorker();
    const db = createAdminClient();
    const { data, error } = await db.from('workers').select('*').order('joined_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ workers: data ?? [] });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminWorker();
    const body = await request.json() as { email: string; full_name: string; role: WorkerRole };
    const db   = createAdminClient();

    // Create auth user
    const { data: created, error: createErr } = await db.auth.admin.createUser({
      email:             body.email,
      email_confirm:     true,
      user_metadata:     { full_name: body.full_name },
    });
    if (createErr) throw createErr;

    const { data: worker, error: wErr } = await db.from('workers').insert({
      id:        created.user.id,
      full_name: body.full_name,
      email:     body.email,
      role:      body.role,
      is_active: true,
    }).select().single();
    if (wErr) throw wErr;

    // Send invite email
    await db.auth.admin.generateLink({
      type:  'magiclink',
      email: body.email,
    });

    return NextResponse.json({ worker }, { status: 201 });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdminWorker();
    const body = await request.json() as { id: string; is_active?: boolean; role?: WorkerRole; brands_assigned?: string[] };
    const db   = createAdminClient();

    const updates: Record<string, unknown> = {};
    if (body.is_active !== undefined)     updates.is_active       = body.is_active;
    if (body.role !== undefined)          updates.role            = body.role;
    if (body.brands_assigned !== undefined) updates.brands_assigned = body.brands_assigned;

    const { data, error } = await db.from('workers').update(updates).eq('id', body.id).select().single();
    if (error) throw error;
    return NextResponse.json({ worker: data });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
